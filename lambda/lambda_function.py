import json
import boto3

def lambda_handler(event, context):

  ecs = boto3.client('ecs', region_name='us-west-2')
  response = ecs.describe_services(
    cluster='minecraft',
    services=[
      'minecraft-server',
    ]
  )

  desired = response["services"][0]["desiredCount"]

  if desired == 0:
    ecs.update_service(
      cluster='minecraft',
      service='minecraft-server',
      desiredCount=1
    )
    print("Updated desiredCount to 1")
  else:
    print("desiredCount already at 1")
