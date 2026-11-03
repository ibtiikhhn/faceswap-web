import * as migration_20261024_145422_initial_d1 from './20261024_145422_initial_d1';
import * as migration_20261103_131127 from './20261103_131127';

export const migrations = [
  {
    up: migration_20261024_145422_initial_d1.up,
    down: migration_20261024_145422_initial_d1.down,
    name: '20261024_145422_initial_d1',
  },
  {
    up: migration_20261103_131127.up,
    down: migration_20261103_131127.down,
    name: '20261103_131127'
  },
];
