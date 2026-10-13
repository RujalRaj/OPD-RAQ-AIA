import json
from unittest.mock import Mock

import pytest
from conftest import create_patient, login

from backend.services.translation import TranslationResponse, translate


@pytest.mark.parametrize(
    "language,text,translated",
    [
        ("en-IN", "Severe pain", "तेज़ दर्द"),
        ("hi-IN", "तेज़ दर्द", "Severe pain"),
    ],
)
def test_prepared_translation_both_languages_is_cached_without_changing_patient(
    client, language, text, translated
):
    login(client, "doctor")
    p = create_patient(client, language=language, original_text=text, confirmed_text=text)
    url = f"/api/v1/encounters/{p['id']}/translation"
    response = client.post(url).json()
    assert response["text"] == translated
    assert response["status"] == "COMPLETE"
    assert response["provider"] == "DEMO_PHRASEBOOK"
    assert response["target_language"] != language
    assert client.post(url).json() == response
    assert client.get(url).json() == response
    after = client.get(f"/api/v1/encounters/{p['id']}").json()
    assert after == p
    logs = client.get(f"/api/v1/encounters/{p['id']}/audit").json()
    assert len([x for x in logs if x["type"] == "SYMPTOM_TRANSLATION_REQUESTED"]) == 1


def test_live_translation_gets_only_original_report_and_survives_staff_update(client, monkeypatch):
    login(client)
    p = create_patient(
        client, language="hi-IN", original_text="कल से सिर दर्द है।", confirmed_text="सिर में दर्द"
    )
    monkeypatch.setenv("AI_PROVIDER", "groq")
    model = Mock(return_value="I have had a headache since yesterday.")
    monkeypatch.setattr("backend.main.translate", model)
    url = f"/api/v1/encounters/{p['id']}/translation"
    assert client.post(url).json()["status"] == "PENDING"
    result = client.get(url).json()
    assert result["status"] == "COMPLETE"
    assert result["text"] == model.return_value
    model.assert_called_once_with("कल से सिर दर्द है।", "hi-IN", "en-IN")
    # No queue mutation, no fresh triage, and original remains byte-for-byte.
    assert client.get(f"/api/v1/encounters/{p['id']}").json() == p
    client.post(url)
    assert model.call_count == 1


def test_provider_error_never_leaks_and_retry_can_recover(client, monkeypatch):
    login(client)
    p = create_patient(client)
    monkeypatch.setenv("AI_PROVIDER", "groq")
    model = Mock(side_effect=RuntimeError("secret-provider-message"))
    monkeypatch.setattr("backend.main.translate", model)
    url = f"/api/v1/encounters/{p['id']}/translation"
    client.post(url)
    result = client.get(url)
    assert result.json()["status"] == "UNAVAILABLE"
    assert "secret-provider-message" not in result.text
    assert client.get(f"/api/v1/encounters/{p['id']}").json() == p
    model.side_effect = None
    model.return_value = "New concern"
    client.post(url)
    assert client.get(url).json()["status"] == "COMPLETE"


def test_disabled_provider_and_checkbox_only_do_not_invent_translation(client):
    login(client)
    text_patient = create_patient(client)
    response = client.post(f"/api/v1/encounters/{text_patient['id']}/translation").json()
    assert response["status"] == "UNAVAILABLE"
    assert response["text"] == ""
    checkbox = create_patient(client, original_text="", confirmed_text="", symptoms=["rule_11"])
    result = client.post(f"/api/v1/encounters/{checkbox['id']}/translation").json()
    assert result["status"] == "EMPTY"


def test_translation_is_staff_only(client):
    for method in (client.get, client.post):
        assert method("/api/v1/encounters/unknown/translation").status_code == 401


def test_groq_translation_uses_strict_response_and_only_report(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "test-key-never-send")
    constructor = Mock()
    monkeypatch.setattr("openai.OpenAI", constructor)
    choice = Mock(
        finish_reason="stop", message=Mock(refusal=None, content=json.dumps({"text": "तेज़ दर्द"}))
    )
    constructor.return_value.chat.completions.create.return_value.choices = [choice]
    assert translate("Severe pain", "en-IN", "hi-IN") == "तेज़ दर्द"
    args = constructor.return_value.chat.completions.create.call_args.kwargs
    assert args["response_format"]["json_schema"]["strict"] is True
    assert json.loads(args["messages"][1]["content"]) == {
        "source_language": "en-IN",
        "target_language": "hi-IN",
        "report": "Severe pain",
    }
    assert constructor.call_args.kwargs["base_url"] == "https://api.groq.com/openai/v1"
    choice.message.content = '{"text":"Pain"}'
    with pytest.raises(ValueError):
        translate("Severe pain", "en-IN", "hi-IN")
    with pytest.raises(ValueError):
        TranslationResponse(text="  ")
    with pytest.raises(ValueError):
        TranslationResponse(text="Hello", priority="ROUTINE")
