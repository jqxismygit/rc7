import type { BrokerOptions } from 'moleculer';
import config from 'config';

const brokerConfig: BrokerOptions = Object.assign(
  {},
  config.broker
);

export default brokerConfig;
