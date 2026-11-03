import * as migration_20260916_111945_initial_cms from './20260916_111945_initial_cms';
import * as migration_20261103_131135_media_storage_prefix from './20261103_131135_media_storage_prefix';

export const migrations = [
  {
    up: migration_20260916_111945_initial_cms.up,
    down: migration_20260916_111945_initial_cms.down,
    name: '20260916_111945_initial_cms',
  },
  {
    up: migration_20261103_131135_media_storage_prefix.up,
    down: migration_20261103_131135_media_storage_prefix.down,
    name: '20261103_131135_media_storage_prefix'
  },
];
