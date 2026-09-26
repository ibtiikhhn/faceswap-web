import * as migration_20260916_111945_initial_cms from './20260916_111945_initial_cms';

export const migrations = [
  {
    up: migration_20260916_111945_initial_cms.up,
    down: migration_20260916_111945_initial_cms.down,
    name: '20260916_111945_initial_cms'
  },
];
