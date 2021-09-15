interface TwilioConfig {
  phoneFrom: string;
  phoneTo: string;
  accountId: string;
  authCode: string;
}

export interface StackConfig {
  domainName: string;
  subdomainPart: string;
  serverRegion: string;
  startupMinutes: string;
  shutdownMinutes: string;
  useFargateSpot: boolean;
  taskMemory: number;
  taskCpu: number;
  snsEmailAddress: string;
  twilio: TwilioConfig;
}
