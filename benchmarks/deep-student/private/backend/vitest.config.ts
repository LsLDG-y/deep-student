import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['benchmarks/deep-student/private/backend/DS-B10/test.test.ts']}});
