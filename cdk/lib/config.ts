import * as dotenv from 'dotenv';
import * as ini from 'ini';
import * as glob from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import {ContainerConfig, MinecraftImageEnv, StackConfig} from './types';
import {stringAsBoolean} from './util';

const resolveMinecraftEnvVars = (json = ''): MinecraftImageEnv => {
    const defaults = {EULA: 'TRUE'};
    try {
        return {
            ...defaults,
            ...JSON.parse(json),
        };
    } catch (e) {
        console.error(
            'Unable to resolve .env value for MINECRAFT_IMAGE_ENV_VARS_JSON.\
            Defaults will be used'
        );
        return defaults;
    }
};

export const resolveConfig = (): StackConfig => {

    dotenv.config({path: path.resolve(__dirname, '../.env')});

    const files = glob.globSync(path.resolve(__dirname, "../container/*.ini"))

    const containers: ContainerConfig[] = [];
    for (const f of files) {
        const map = ini.parse(fs.readFileSync(f, 'utf-8'))
        const containerConfig: ContainerConfig = {
            prefix: map['PREFIX'] || '',
            serviceName: map['SERVICE_NAME'] || 'minecraft-server',
            subdomainPart: map['SUBDOMAIN_PART'] || 'minecraft',
            minecraftEdition:
                map['MINECRAFT_EDITION'] === 'bedrock' ? 'bedrock' : 'java',
            shutdownMinutes: map['SHUTDOWN_MINUTES'] || '20',
            startupMinutes: map['STARTUP_MINUTES'] || '10',
            useFargateSpot: map['USE_FARGATE_SPOT'],
            taskCpu: +(map['TASK_CPU'] || 1024),
            taskMemory: +(map['TASK_MEMORY'] || 2048),
            minecraftImageEnv: resolveMinecraftEnvVars(
                map['MINECRAFT_IMAGE_ENV_VARS_JSON']
            ),
            snsEmailAddress: map['SNS_EMAIL_ADDRESS'] || '',
            twilio: {
                phoneFrom: map['TWILIO_PHONE_FROM'] || '',
                phoneTo: map['TWILIO_PHONE_TO'] || '',
                accountId: map['TWILIO_ACCOUNT_ID'] || '',
                authCode: map['TWILIO_AUTH_CODE'] || '',
            },
            debug: map['DEBUG'],
        }
        containers.push(containerConfig);
    }

    return {
        domainName: process.env.DOMAIN_NAME || '',
        vpcId: process.env.VPC_ID || '',
        serverRegion: process.env.SERVER_REGION || 'us-east-1',
        containerConfigs: containers,
    }
};
