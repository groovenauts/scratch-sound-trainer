/**
 * @license
 * Copyright 2019 Groovenauts, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import fetch from 'fetch';

export default function modelSaveHandler(postURL) {
    return async function (artifacts) {
        const weightBlob = new Blob([artifacts.weightData], { type: "application/octet-stream"} );
        const spec = {
            "modelTopology": artifacts.modelTopology,
            "weightsManifest": [
                {
                    "paths": ["weights.bin"],
                    "weights": artifacts.weightSpecs
                }
            ]
        };
        const json = JSON.stringify(spec);

        function assignKey() {
            return new Promise((resolve, reject) => {
                window.fetch(postURL, { method: "POST", body: "" })
                    .then(res => {
                        return res.json()
                    })
                    .then(body => {
                        resolve(body)
                    })
                    .catch(error => {
                        console.log("POST model failed: "+ error)
                        reject(error);
                    });
            });
        }

        function upload(signedUrl, contentType, content) {
            return new Promise((resolve, reject) => {
                window.fetch(signedUrl, {body: content, method: "PUT", headers: { "Content-Type": contentType } })
                    .then(res => resolve())
                    .catch(error => {
                        console.log("PUT object via Signed URL failed: " + error)
                        reject(error);
                    });
            });
        }

        const res = await assignKey();
        if (!res.success) {
            console.log("Failed to get unique key and Signed URLs for model uploads: " + res)
            return
        }
        await upload(res.weightsUrl, "application/octet-stream" weightBlob)
        await upload(res.modelUrl, "application/json", json)

        return res.key;
    };
}

// vim:ft=javascript sw=4
