import json, boto3

br = boto3.client("bedrock-runtime", region_name="eu-west-1")

body = {
    "prompt": "Write one sentence about Demacia, honor, and vision control.",
    "max_tokens": 120,
    "temperature": 0.7
}

resp = br.invoke_model(
    modelId="mistral.mistral-7b-instruct-v0:2",
    contentType="application/json",
    accept="application/json",
    body=json.dumps(body),
)

data = json.loads(resp["body"].read())
print(data["outputs"][0]["text"])
