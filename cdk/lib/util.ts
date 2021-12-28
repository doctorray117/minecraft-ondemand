import { Port } from 'aws-cdk-lib/lib/aws-ec2';
import { Protocol } from 'aws-cdk-lib/lib/aws-ecs';
import * as execa from 'execa';
import { constants } from './constants';
import { MinecraftEditionConfig, StackConfig } from './types';

export const stringAsBoolean = (str?: string): boolean =>
  Boolean(str === 'true');

export const isDockerInstalled = (): boolean => {
  try {
    execa.sync('docker', ['version']);
    return true;
  } catch (e) {
    return false;
  }
};

function imageFromTag(base:string, tag:string) {
  if (tag && tag.length > 0) {
    if (base.includes(':')) {
      return base.substring(0, base.indexOf(':')) + ':' + tag
    } else {
      return base + ':' + tag;
    }
  } else {
    return base;
  }
}

export const getMinecraftServerConfig = (
  edition: StackConfig['minecraftEdition'],
  imageTag: StackConfig['minecraftImageTag']
): MinecraftEditionConfig => {
  const javaEditionImage = imageFromTag(constants.JAVA_EDITION_DOCKER_IMAGE, imageTag)
  const bedrockEditionImage = imageFromTag(constants.BEDROCK_EDITION_DOCKER_IMAGE, imageTag)
  const javaConfig = {
    image: javaEditionImage,
    port: 25565,
    protocol: Protocol.TCP,
    ingressRulePort: Port.tcp(25565),
  };

  const bedrockConfig = {
    image: bedrockEditionImage,
    port: 19132,
    protocol: Protocol.UDP,
    ingressRulePort: Port.udp(19132),
  };

  return edition === 'java' ? javaConfig : bedrockConfig;
};
