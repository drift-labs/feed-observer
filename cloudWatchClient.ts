import AWS from 'aws-sdk';

export class CloudWatchClient {
	cloudWatch: AWS.CloudWatch;

	public constructor(region: string) {
		this.cloudWatch = new AWS.CloudWatch({ region });
	}

	public logLeaseRunningOut(): void {
		const params = {
			MetricData: [
				{
					MetricName: 'LeaseRunningOut',
					Unit: 'None',
					Value: 1,
				},
			],
			Namespace: 'Switchboard',
		};
		this.cloudWatch.putMetricData(params, (err) => {
			if (err) {
				console.error(err);
			}
		});
	}
}
