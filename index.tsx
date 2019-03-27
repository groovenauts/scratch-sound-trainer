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

import * as tf from '@tensorflow/tfjs';
import * as speechCommands from '@tensorflow-models/speech-commands';

import formatMessage from "format-message";
import React, { useState, useEffect, useRef, useReducer } from 'react';
import ReactDOM from 'react-dom';

import modelSaveHandler from "./modelSave";

const postURL = "https://scratch-sound-model-dot-ai-for-edu.appspot.com/models";

let translations = {
  "ja": {
    "headerMessage": "スクラッチに音をおぼえさせよう!",
    "train": "トレーニング",
    "save": "アップロード",
    "accessKey": "カギをゲットした",
  },
  "en": {
    "headerMessage": "Teach scratch with sounds!",
    "train": "Train",
    "save": "Upload",
    "accessKey": "You got a key",
  }
};

formatMessage.setup({
    locale: "ja-JP",
    translations: translations,
    missingTranslation: "ignore",
});

const MAX_LABELS = 10;

const Header = () => {
const onClick=() => console.log(tf.memory());
    return <header onClick={onClick}>
        <div>{formatMessage({
                            id: "headerMessage",
                            default: "スクラッチに音をおぼえさせよう!",
                            description: "Text message in header."
        })}</div>
        </header>;
}

class Action {
    constructor(public type: string,
                public data: any){
        this.type = type;
        this.data = data;
    }
}

const Mic = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    let stopCallback = null;

    const toggleMicFlag = () => {
        dispatch(new Action("setMicFlag", !appInfo.micFlag));
    };

    useEffect(() => {
        if (appInfo.micFlag) {
            appInfo.recognizer.listen((r) => {
                let label = -1;
                let max = 0;
                for (let i = 0; i < appInfo.selectorNumber; i++) {
                    if (max < r.scores[i]) {
                        label = i;
                        max = r.scores[i];
                    }
                }
                dispatch(new Action("setPredicted", label));
            }, { probabilityThreshold: 0.5 });
        } else {
            if (appInfo.recognizer.isListening()) {
                appInfo.recognizer.stopListening();
            }
        }
    }, [appInfo.micFlag]);

    return <div className="mic-container">
        <div className="mic-controller">
          { appInfo.micFlag ?
              <button className="mdl-button mdl-js-button mdl-button--raised mdl-button--accent" disabled={appInfo.phase != "done"} onClick={toggleMicFlag} ><i className="material-icons">pause</i></button> :
              <button className="mdl-button mdl-js-button mdl-button--raised mdl-button--accent" disabled={appInfo.phase != "done"} onClick={toggleMicFlag} ><i className="material-icons">play_circle_filled</i></button>}
        </div>
      </div>
}

function drawCanvas(imageData, canvas) {
    const ctx = canvas.getContext('2d');
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = imageData.width;
    tmpCanvas.height = imageData.height;
    tmpCanvas.getContext("2d").putImageData(imageData, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.resetTransform();
    ctx.scale(canvas.width / imageData.width, canvas.height / imageData.height);
    ctx.drawImage(tmpCanvas, 0, 0);
}

function clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.width);
}

function spectrogramToImage(spectrogram) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < spectrogram.data.length; ++i) {
        const x = spectrogram.data[i];
        if ( x !== -Infinity) {
            if ( x < min ) {
                min = x;
            }
            if ( x > max ) {
                max = x;
            }
        }
    }
    const height = spectrogram.frameSize;
    const width = Math.ceil(spectrogram.data.length / spectrogram.frameSize);
    const image = new ImageData(width, height);
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const j = ( x + y * width) * 4;
            const freq = height - y - 1;
            const power = spectrogram.data[freq + x * height];
            const pixel = (power - min) / (max - min);
            image.data[j+0] = Math.round(Math.pow(pixel, 3) * 255);
            image.data[j+1] = 0;
            image.data[j+2] = 0;
            image.data[j+3] = 255;
        }
    }
    return image;
}

const Selector = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    const recording = appInfo.recordingIndex === props.index;
    const disabled = appInfo.recordingIndex !== null && !recording;

    const canvasRef = useRef(null);

    useEffect(() => {
        if (recording) {
            appInfo.recognizer.collectExample(String(props.index), { durationSec: 2 }).then((spectrogram) => {
                const image = spectrogramToImage(spectrogram);
                dispatch(new Action("setRecordingIndex", null));
                dispatch(new Action("setSampleImage", { index: props.index, image: image }));
                dispatch(new Action("setSampleNumbers"));
            });

        }
    }, [recording]);

    useEffect(() => {
        if (props.sampleImage) {
            drawCanvas(props.sampleImage, canvasRef.current);
        } else {
            clearCanvas(canvasRef.current);
        }
    }, [props.sampleImage]);

    const badge;
    if (props.sampleNumber == 0) {
        badge = null;
    } else {
        badge = props.sampleNumber;
    }

    const startRecording = () => {
        dispatch(new Action("setRecordingIndex", props.index));
    };

    const canvasClassNames = [ "selector-canvas" ];

    return <div className={"selector-cell" + (props.isPredicted ? " predicted" : "")} >
        <div className="selector-label" >
          <span className="mdl-chip" ><span className="mdl-chip__text">{ props.index + 1 }</span></span>
        </div>
        <div className="mdl-badge mdl-badge--overlap" data-badge={badge} >
          <canvas className={canvasClassNames.join(" ")} id={"canvas-" + props.index} width={200} height={60} ref={canvasRef} />
        </div>
        { recording ?
          <button className="capture-button mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab mdl-button--colored" >
            <i className="material-icons">mic</i>
          </button> :
          <button className="capture-button mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab" disabled={disabled} onClick={startRecording} >
            <i className="material-icons">record_voice_over</i>
          </button>
        }
    </div>;
};

const AddSelector = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    const incrementSelector = () => {
        dispatch(new Action("setSelectorNumber", appInfo.selectorNumber + 1));
    };
    return <div className="add-selector-cell" onClick={incrementSelector} >
        <button className="mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect">
            <i className="material-icons">add</i>
        </button>
    </div>;
};

const Selectors = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    let selectors = [];

    useEffect(() => {
        componentHandler.upgradeAllRegistered();
    }, [appInfo.selectorNumber]);

    for (let i = 0; i < appInfo.selectorNumber; i++) {
        selectors.push(<Selector key={i} index={i} appInfo={appInfo} dispatch={dispatch} isPredicted={i == appInfo.predicted} sampleNumber={appInfo.sampleNumbers[i]} sampleImage={appInfo.sampleImages[i]} />);
    }
    if ( appInfo.selectorNumber < MAX_LABELS ) {
        selectors.push(<AddSelector key="addSelector" index={appInfo.selectorNumber} appInfo={appInfo} dispatch={dispatch} />);
    }
    return <div id="selectors">{selectors}</div>
}

const Trainer = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;
    const phase = appInfo.phase;

    const [ modelKey, setModelKey ] = useState(null);

    const progressRef = useRef(null);

    useEffect(() => {
        if (phase == "training" || phase == "uploading") {
            componentHandler.upgradeAllRegistered();
        }
    }, [phase]);

    function train() {
        dispatch(new Action("setPhase", "training"));
        setTimeout(() => {
            appInfo.recognizer.train({
                epochs: 50,
                fineTuningEpochs: 50,
                callback: {
                    onEpochEnd: (epoch, logs) => {
                        console.log(`Epoch: ${epoch} Loss: ${logs.loss.toFixed(5)}`);
                        if (progressRef.current) {
                            progressRef.current.MaterialProgress.setProgress(epoch*2);
                        }
                    }
                },
                fineTuningCallback: {
                    onEpochEnd: (epoch, logs) => {
                        console.log(`Epoch: ${epoch} Loss: ${logs.loss.toFixed(5)}`);
                        if (progressRef.current) {
                            progressRef.current.MaterialProgress.setProgress(epoch*2);
                        }
                    }
                },
            }).then(() => {
                dispatch(new Action("setPhase", "done"));
            })
        }, 200);
    }

    function save() {
        dispatch(new Action("setMicFlag", false));
        dispatch(new Action("setPhase", "uploading"));
        setTimeout(() => {
            appInfo.recognizer.save(tf.io.withSaveHandler(modelSaveHandler(postURL))).then((key) => {
                setModelKey(key);
                dispatch(new Action("setMicFlag", false));
                dispatch(new Action("setPhase", "uploaded"));
            }).catch((error) => {
                console.log("Failed to save model: " + error);
                dispatch(new Action("setPhase", "done"));
            });
        }, 200);
    }

    const elms = [];

    if (phase == "init" || phase == "done" || phase == "uploaded") {
        elms.push(<div key="train-button" ><button id="train-button" className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" onClick={train} >
                  {formatMessage({
                                 id: "train",
                                 default: "トレーニング",
                                 description: "Text message on train button."
                  })}
                  </button></div>);
    }
    if (phase == "training") {
        elms.push(<div key="progress-bar" className="training-progress-bar"><div className="mdl-progress mdl-js-progress" ref={progressRef} ></div></div>);
    }
    if (phase == "uploading") {
        elms.push(<div key="spinner" className="uploading-spinner"><div className="mdl-spinner mdl-js-spinner is-active"></div></div>);
    }
    if (phase == "done") {
        elms.push(<div key="save-button" >
                    <button id="save-button" className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect" onClick={save} >
                      {formatMessage({
                          id: "save",
                          default: "アップロード",
                          description: "Text message on upload button."
                      })}
                    </button>
                  </div>);
    }
    if (phase == "uploaded") {
        elms.push(<div className="access-key" key="model-key" >
                  {formatMessage({
                                 id: "accessKey",
                                 default: "カギをゲットした",
                                 description: "Text message for getting access key."
                  })} : <span>{modelKey}</span></div>);
    }

    return <div id="trainer">
        {elms}
        </div>
};

const Menu = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    const resetAll = () => {
        dispatch(new Action("resetAll"));
    };

    const loadFromFile = () => {
        if (!(window.FileList && window.FileReader && window.Blob)) {
            alert("The File APIs are not supported in your browser.");
            return;
        }
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.addEventListener("change", (e) => {
            const files = e.target.files;
            if (files.length < 1) {
                return;
            }
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const buffer = e.target.result;
                const labels_num = (new Uint32Array(buffer, 0, 1))[0];
                if (labels_num > MAX_LABELS) {
                    alert("This file contains too many labels.");
                    return;
                }
                const examplesLength = new Uint32Array(buffer, 1*4, 1)[0];
                let cursor = 2*4;
                const sampleImagesHeader = new Uint32Array(buffer, cursor, labels_num*3);
                cursor += labels_num * 3 * 4;
                const sampleImagesMeta = [];
                for (let i = 0; i < labels_num; i++) {
                    const byteLength = sampleImagesHeader[i*3];
                    const width = sampleImagesHeader[i*3+1];
                    const height = sampleImagesHeader[i*3+2];
                    sampleImagesMeta.push([byteLength, width, height]);
                }
                const examplesBuffer = buffer.slice(cursor, cursor + examplesLength);;
                cursor += examplesLength;
                const clearFlag;
                if (appInfo.recognizer && appInfo.sampleNumbers.reduce((i,j) => i + j) > 0) {
                    clearFlag = true;
                } else {
                    clearFlag = false;
                }
                appInfo.recognizer.loadExamples(examplesBuffer, clearFlag);
                const imageData = [];
                for (let i = 0; i < labels_num; i++) {
                    const byteLength = sampleImagesMeta[i][0];
                    const width = sampleImagesMeta[i][1];
                    const height = sampleImagesMeta[i][2];
                    if (byteLength > 0) {
                        const buff = new Uint8ClampedArray(buffer, cursor, byteLength);
                        const imgData = new ImageData(width, height);
                        for (let j = 0; j < buff.length; j++) {
                            imgData.data[j] = buff[j];
                        }
                        cursor += byteLength;
                        imageData.push(imgData);
                    } else {
                        imageData.push(null);
                    }
                }
                const newSampleNumbers = [];
                for (let i = 0; i < MAX_LABELS; ++i) {
                    if (i < labels_num) {
                        newSampleNumbers.push(appInfo.recognizer.countExamples()[String(i)]);
                    } else {
                        newSampleNumbers.push(0);
                    }
                }
                dispatch(new Action("loadData", {
                    selectorNumber: labels_num,
                    sampleImages: imageData,
                    sampleNumbers: newSampleNumbers
                });
            };
            reader.readAsArrayBuffer(file);
        });
        fileInput.click();
    };

    const saveToFile = () => {
        if (appInfo.recognizer === null) {
            return;
        }
        const buffer = appInfo.recognizer.serializeExamples();
        const blobs = [];
        const header = new Uint32Array(2);
        header[0] = appInfo.selectorNumber;
        header[1] = buffer.byteLength;

        const sampleImagesHeader = new Uint32Array(appInfo.selectorNumber*3);
        const sampleImages = [];
        for (let i = 0; i < appInfo.selectorNumber; i++) {
            const simage = appInfo.sampleImages[i];
            if (simage) {
                const b = new Blob([simage.data]);
                sampleImagesHeader[i*3+0] = b.size;
                sampleImagesHeader[i*3+1] = appInfo.sampleImages[i].width;
                sampleImagesHeader[i*3+2] = appInfo.sampleImages[i].height;
                sampleImages.push(b);
            } else {
                sampleImagesHeader[i*3+0] = 0;
                sampleImagesHeader[i*3+1] = 0;
                sampleImagesHeader[i*3+2] = 0;
            }
        }
        blobs.push(new Blob([header]));
        blobs.push(new Blob([sampleImagesHeader]));
        blobs.push(new Blob([buffer]));
        sampleImages.forEach((b) => blobs.push(b));
        const totalBlob = new Blob(blobs, {type: "application/octet-stream"});
        const blobURL = URL.createObjectURL(totalBlob);
        const anchor = document.createElement("a");
        anchor.href = blobURL;
        anchor.target = "_blank";
        anchor.download = "SoundData.dat"
        anchor.click();
    };

    return <div className="menu">
        <button id="menu-button" className="mdl-button mdl-js-button mdl-button--icon">
            <i className="material-icons">menu</i>
        </button>
        <ul className="mdl-menu mdl-menu--bottom-left mdl-js-menu" htmlFor="menu-button" >
            <li className="mdl-menu__item menu-item" onClick={resetAll} >Reset</li>
            <li className="mdl-menu__item menu-item" onClick={loadFromFile} >Load from file</li>
            <li className="mdl-menu__item menu-item" onClick={saveToFile} >Save to file</li>
        </ul>
        </div>
};

const Main = (props) => {
    const appInfo = props.appInfo;
    const dispatch = props.dispatch;

    if (appInfo.recognizer) {
        return <div className="main">
                <Mic appInfo={appInfo} dispatch={dispatch} />
                <Selectors appInfo={appInfo} dispatch={dispatch} />
                <Trainer appInfo={appInfo} dispatch={dispatch} />
            </div>
    } else {
        return <div className="main"><span className="loading-message">Loading models...</spam></div>
    }
};

function appReducer(appInfo, action) {
    switch(action.type) {
    case "setRecognizer":
        return { ...appInfo, ...{ recognizer: action.data } };
    case "setPhase":
        return { ...appInfo, ...{ phase: action.data } };
    case "setSampleNumbers":
        const newSampleNumbers = [];
        for (let i = 0; i < MAX_LABELS; i++) {
            newSampleNumbers.push(appInfo.recognizer.countExamples()[String(i)] || 0);
        }
        return { ...appInfo, ...{ sampleNumbers: newSampleNumbers }};
    case "setSampleImage":
        const newSampleImages = [];
        for (let i = 0; i < MAX_LABELS; i++) {
            if (i === action.data.index) {
                newSampleImages.push(action.data.image);
            } else {
                newSampleImages.push(appInfo.sampleImages[i]);
            }
        }
        return { ...appInfo, ...{ sampleImages: newSampleImages }};
    case "setSelectorNumber":
        return { ...appInfo, ...{ selectorNumber: action.data }};
    case "setMicFlag":
        return { ...appInfo, ...{ micFlag: action.data, predicted: (action.data) ? appInfo.predicted : null }};
    case "setRecordingIndex":
        return { ...appInfo, ...{ recordingIndex: action.data }};
    case "setPredicted":
        return { ...appInfo, ...{ predicted: appInfo.micFlag ? action.data : null }};
    case "resetAll":
        if (appInfo.recognizer && appInfo.sampleNumbers.reduce((i,j) => i + j) > 0) {
            appInfo.recognizer.clearExamples();
        }
        if (appInfo.recognizer) {
            /** FIXME: dispose() these models cause error at training with new created recognizer.
             *  I think dropout layers has some global tensor?
            if (appInfo.recognizer.model){
                appInfo.recognizer.model.dispose();
            } else if (appInfo.recognizer.baseModel) {
                appInfo.recognizer.baseModel.dispose();
            }
            */
            /* <<<<< Workarounds: The layers except dropout can be disposed. >>>>> */
            const layers;
            if (appInfo.recognizer.model) {
                layers = appInfo.recognizer.model.layers;
            } else if (appInfo.recognizer.baseModel) {
                layers = appInfo.recognizer.baseModel.layers;
            }
            layers.forEach((l) => {
                if ( !l.name.startsWith("dropout_") ) {
                    l.dispose();
                }
            });
            /* >>>>> Workaround <<<<< */
        }
        return {
            ...appInfo,
            ...{
                recognizer: null,
                micFlag: false,
                phase: "init",
                selectorNumber: 2,
                sampleImages: Array.apply(null, Array(MAX_LABELS)).map(function(){return null;}),
                sampleNumbers: Array.apply(null, Array(MAX_LABELS)).map(function(){return 0;}),
                predicted: null
            }
        };
    case "loadData":
        return { ...appInfo, ...action.data };
    default:
        return appInfo;
    }
}

const Application = () => {
    const initialAppInfo = {
        phase: "init",
        micFlag: false,
        selectorNumber: 2,
        sampleImages: Array.apply(null, Array(MAX_LABELS)).map(function(){return null;}),
        sampleNumbers: Array.apply(null, Array(MAX_LABELS)).map(function(){return 0;}),
        recordingIndex: null,
        recognizer: null
    };
    const [ appInfo, dispatch ] = useReducer(appReducer, initialAppInfo);

    useEffect(() => {
        if (appInfo.recognizer == null) {
            const base = speechCommands.create("BROWSER_FFT");
            base.ensureModelLoaded().then(() => {
                const recognizer = base.createTransfer("recognizer");
                // Monkey Patching speech-recognizer's TransferRecognizer.createTransferModelFromBaseModel()
                // to get rid of model save issue
                const patchedCreateTransferModelFromBaseModel = () => {
                    const layers = recognizer.baseModel.layers;
                    let layerIndex = layers.length - 2;
                    while (layerIndex >= 0) {
                        if (layers[layerIndex].getClassName().toLowerCase() === 'dense') {
                            break;
                        }
                        layerIndex--;
                    }
                    if (layerIndex < 0) {
                        throw new Error('Cannot find a hidden dense layer in the base model.');
                    }
                    const truncatedBaseLayers = layers.slice(0, layerIndex);
                    recognizer.secondLastBaseDenseLayer = layers[layerIndex];
                    recognizer.model = tf.sequential({layers: truncatedBaseLayers.concat([tf.layers.dense({ units: recognizer.words.length, activation: "softmax"})])});
                }
                recognizer.createTransferModelFromBaseModel = patchedCreateTransferModelFromBaseModel;
                dispatch(new Action("setRecognizer", recognizer));
            });
        }

        return () => {
        };
    }, [appInfo.recognizer]);

    return <div className="root">
            <Header />
            <Menu appInfo={appInfo} dispatch={dispatch} />
            <Main appInfo={appInfo} dispatch={dispatch} />
        </div>;
};

ReactDOM.render(<Application />, document.getElementById('app'));

// vim:ft=javascript sw=4
