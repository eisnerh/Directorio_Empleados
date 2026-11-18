import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',fullyParallel:false,workers:1,retries:0,
  reporter:[['list'],['json',{outputFile:process.env.DIRECTORY_TEST_JSON || 'test-results/results.json'}]],
  use:{baseURL:'http://127.0.0.1:4173',headless:true,viewport:{width:1280,height:900},
    channel:process.env.DIRECTORY_BROWSER || undefined,trace:'retain-on-failure'},
  webServer:{command:'node scripts/serve.mjs --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:15000}
});
