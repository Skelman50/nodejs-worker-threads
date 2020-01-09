const { Worker } = require("worker_threads");
const Pool = require("worker-threads-pool");

const path = require("path");
const os = require("os");
const ora = require("ora");

// this is how we can get the count of cpu's the computer has,
// using a larger number may result in the app crushing
const cpuCount = os.cpus().length;
const pool = new Pool({ max: cpuCount });
// create some big array
const elements = 5000000;
console.log(`generating ${elements} random numbers...`);
const bigArray = Array(elements)
  .fill()
  .map(() => Math.random());

// we get the path of the script
const workerScript = path.join(__dirname, "./sorter.js");

// we turn the worker activation into a promise
const sortArrayWithWorker = arr => {
  return new Promise((resolve, reject) => {
    pool.acquire(workerScript, { workerData: arr }, (err, worker) => {
      if (err) {
        return reject(err);
      }
      worker.once("message", resolve);
      worker.once("error", reject);
    });
  });
};

// this function will distribute the array across workers
async function distributeLoadAcrossWorkers(workers) {
  // how many elements each worker should sort
  const segmentsPerWorker = Math.round(bigArray.length / workers);
  const promises = Array(workers)
    .fill()
    .map((_, index) => {
      let arrayToSort;
      if (index === 0) {
        // the first segment
        arrayToSort = bigArray.slice(0, segmentsPerWorker);
      } else if (index === workers - 1) {
        // the last segment
        arrayToSort = bigArray.slice(segmentsPerWorker * index);
      } else {
        // intermediate segments
        arrayToSort = bigArray.slice(
          segmentsPerWorker * index,
          segmentsPerWorker * (index + 1)
        );
      }
      return sortArrayWithWorker(arrayToSort);
    });
  // merge all the segments of the array
  const segmentsResults = await Promise.all(promises);
  return segmentsResults.reduce((acc, arr) => acc.concat(arr), []);
}

// this is the main function (it's only to allow the use of async await for simplicity)
async function run() {
  //   const spinner = ora("Loading unicorns").start();
  //   spinner.color = "yellow";
  //   spinner.text = "sorting... this may take a while...";

  // sort with a single worker
  const start1 = Date.now();
  const result1 = await distributeLoadAcrossWorkers(1);
  console.log(
    `sorted ${result1.length} items, with 1 worker in ${Date.now() - start1}ms`
  );

  // sort with no worker at all
  let start2 = Date.now();
  const result2 = bigArray.sort((a, b) => a - b);
  console.log(
    `sorted2 ${result2.length} items, without workers in ${Date.now() -
      start2}ms`
  );

  const start3 = Date.now();
  const result3 = await distributeLoadAcrossWorkers(cpuCount);
  console.log(
    `sorted ${result3.length} items, with ${cpuCount} workers in ${Date.now() -
      start3}ms`
  );

  //   spinner.stop();
  console.log("\n done");
}

run();
