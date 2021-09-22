interface TwilioConfig {
  phoneFrom: string;
  phoneTo: string;
  accountId: string;
  authCode: string;
}

export type MinecraftImageEnv  = Record<string, string>;

export interface StackConfig {
  domainName: string;
  subdomainPart: string;
  serverRegion: string;
  startupMinutes: string;
  shutdownMinutes: string;
  useFargateSpot: boolean;
  taskMemory: number;
  taskCpu: number;
  vpcId: string;
  snsEmailAddress: string;
  twilio: TwilioConfig;
  minecraftImageEnv: MinecraftImageEnv;
  debug: boolean;
}
