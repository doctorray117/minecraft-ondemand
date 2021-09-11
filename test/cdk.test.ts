import * as cdk from 'aws-cdk-lib';
import * as Cdk from '../lib/minecraft-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Cdk.MinecraftStack(app, 'MyTestStack');
    // THEN
    const actual = app.synth().getStackArtifact(stack.artifactId).template;
    // expect(actual.Resources ?? {}).toEqual({});
    expect(actual.Resources).toBeTruthy();
});
