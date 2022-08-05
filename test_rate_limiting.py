import requests
import json
import random
from multiprocessing import Process, Manager
import time


def worker_proc(worker_number, rate_limit_hits, out_of_retries_hits, error_hits, successes):
    print("Worker {} received a job.".format(worker_number))
    def make_request():
        request_raw_dict = {
            "input": {
                "bounds": {
                    "properties": {
                        "crs": "http://www.opengis.net/def/crs/EPSG/0/3857"
                    },
                    "bbox": [
                        1330615.7883883484 + 1000*random.random(),
                        5165920.119625352 + 1000*random.random(),
                        1369751.5468703588 + 1000*random.random(),
                        5205055.878107364 + 1000*random.random()
                    ]
                },
                "data": [
                    {
                        "dataFilter": {
                            "timeRange": {
                                "from": "2022-03-01T00:00:00.000Z",
                                "to": "2022-03-31T23:59:59.999Z"
                            },
                            "mosaickingOrder": "mostRecent",
                            "previewMode": "EXTENDED_PREVIEW",
                            "maxCloudCoverage": 100
                        },
                        "processing": {
                            "upsampling": "NEAREST",
                            "downsampling": "NEAREST"
                        },
                        "type": "LETML2"
                    }
                ]
            },
            "output": {
                "width": 2500,
                "height": 2500,
                "responses": [
                    {
                        "identifier": "default",
                        "format": {
                            "type": "image/tiff"
                        }
                    }
                ]
            },
            "evalscript": """//VERSION=3

            let minVal = 0.0;
            let maxVal = 0.4;

            let viz = new HighlightCompressVisualizer(minVal, maxVal);

            function evaluatePixel(samples) {
                let val = [samples.B03, samples.B02, samples.B01];
                val = viz.processList(val);
                val.push(samples.dataMask);
                return val;
            }

            function setup() {
              return {
                input: [{
                  bands: [
                    "B01",
                    "B02",
                    "B03",
                    "dataMask"
                  ]
                }],
                output: {
                  bands: 4,
                  sampleType: "FLOAT32"
                }
              }
            }"""
                }

        headers = {"content-type": "application/json"}
        headers["Authorization"] = f"Bearer eyJraWQiOiJzaCIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJkZDk4MTk3MC0wYmU5LTQwOTUtODJhMi1lNzA3MjllMzYzMDgiLCJhdWQiOiIxZmViZTk3NC1jYTRmLTQ0YzEtOWZjOC1iYWZiZDNiYjRhYmQiLCJqdGkiOiJkOTY4MzdlNi0zYzQ3LTQzNTctYmFmMy0xMTAxZGQwYzBiYWYiLCJleHAiOjE2NTk3MDE1NjAsIm5hbWUiOiJUZXN0aW5nIFRlc3RlciIsImVtYWlsIjoia2l2YWc2MjcwMUBwYXNodGVyLmNvbSIsImdpdmVuX25hbWUiOiJUZXN0aW5nIiwiZmFtaWx5X25hbWUiOiJUZXN0ZXIiLCJzaWQiOiIzMzgwZmEzZC0xOGMwLTRmMmEtYmViZi05NmI5NzBkMTljNjciLCJkaWQiOjIsImFpZCI6ImE0NTZlZDE4LWFmOTMtNDhlNy1iMzVkLWExOWI2ZWE5MjFmNSIsImQiOnsiMiI6eyJyYSI6e30sInQiOjF9fX0.CH7gYxzEeZVx8NK6fSdUBfFTC42HGdXKaTWV24yi6LxBN0k1lXKJV-pD54J96bmImlQOvmKn-zst238LtrJ_pHZVVb7sqfdFl6dmdf5AnbPtlokqDZd1vSXtsS-waQ3uwHmabXix41hbxxAFgDP46MWJOPHHw74PQ8PvU5FONqnhwMOjThcfTKUtree0MNWsYmrE3o0DPQg2HGngU1Gucd_UX9rREbwy9h7akIvxufPgRMRu4gY-mLDbvWEsdOusLfvSOUtxMr3RBkGUJSVO2Yq5cdMXdLERnZo8dDdfQYOKM4VUuuzaDnvl81yzrvUIhfZ2so92Q7IQ7zAJDuLXGw"

        return requests.post("https://services-uswest2.sentinel-hub.com/api/v1/process", data=json.dumps(request_raw_dict), headers=headers)

    max_retries = 5
    retries = 0
    r = make_request()
    print(r.status_code)

    while r.status_code != 200:
        if retries > max_retries:
            print("Out of retries!")
            out_of_retries_hits.append(worker_number)
            break
        if r.status_code == 429:
            print(r.status_code)
            print(r.headers)
            rate_limit_hits.append(worker_number)
            retry_after = int(r.headers["retry-after"])
            print(f"Worker {worker_number} retrying again after {retry_after}s. N retries:",retries+1)
            time.sleep(retry_after)
               
        elif r.status_code != 200:
            print(r.status_code)
            print(r.content)
            error_hits.append(worker_number)
        r = make_request()
        retries += 1
    else:
        successes.append(worker_number)

    print("="*50)

if __name__ ==  '__main__':
    processes = []
    start_time = time.time()

    with Manager() as manager:
        rate_limit_hits = manager.list()
        out_of_retries_hits = manager.list()
        error_hits = manager.list()
        successes = manager.list()

        for i in range(100):
            p = Process(
                target=worker_proc,
                args=(
                    i,
                    rate_limit_hits,
                    out_of_retries_hits,
                    error_hits,
                    successes
                ),
            )
            p.daemon = True
            print(p)
            p.start()
            processes.append(p)

        for p in processes:
            p.join()

        print(rate_limit_hits)
        print(out_of_retries_hits)
        print(error_hits)
        print(successes)

    print("--- %s seconds ---" % (time.time() - start_time))


# [22, 92, 65, 77, 79, 29, 93, 93]
# []
# [29, 12, 18, 22, 92, 65, 77, 79, 29, 93]
# --- 347.5032362937927 seconds ---

# [53, 39, 21, 49, 68, 52, 70, 30, 35, 91, 56, 40, 95, 52, 80, 23, 74, 25, 56, 23]
# []
# [6, 53, 39, 21, 49, 26, 68, 96, 99, 52, 70, 30, 35, 56, 91, 40, 89, 95, 34, 80, 25, 23, 74, 26, 99, 89]
# [0, 5, 1, 3, 15, 20, 14, 58, 17, 43, 78, 36, 7, 72, 11, 81, 59, 10, 38, 75, 97, 32, 42, 71, 86, 94, 24, 55, 82, 19, 37, 48, 63, 79, 31, 50, 12, 13, 29, 77, 22, 2, 67, 92, 85, 62, 41, 61, 87, 34, 28, 33, 93, 6, 44, 90, 4, 47, 18, 69, 54, 9, 73, 27, 60, 8, 88, 57, 84, 45, 98, 64, 83, 65, 16, 66, 96, 76, 46, 51, 91, 35, 53, 30, 39, 80, 25, 74, 21, 68, 49, 70, 40, 95, 52, 56, 26, 99, 89, 23]
# --- 462.41092681884766 seconds ---