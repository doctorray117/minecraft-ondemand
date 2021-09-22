import * as execa from 'execa';

export const stringAsBoolean = (str?: string): boolean => Boolean(str === 'true');

export const isDockerInstalled = (): boolean => {
  try {
    execa.sync('docker', ['version']);
    return true;
  } catch (e) {
    return false;
  }
}
