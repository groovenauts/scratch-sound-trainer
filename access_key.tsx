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

import React, { useState, useEffect, useRef } from 'react';

export default function AccessKey(props) {
  const label = props.label;
  const accessKey = props.accessKey;

  const [ copying, setCopying ] = useState(false);
  const textboxRef = useRef(null);

  function copy() {
      if (!copying) {
          textboxRef.current.select();
          document.execCommand("copy");
          setCopying(true);
      }
  }

  useEffect(() => {
      if (copying) {
          setTimeout(() => {
              textboxRef.current.blur();
              setCopying(false);
          }, 2000);
      }
  }, [copying]);

  return (<div className="access-key" >
                    {label}
                  : <input type="text" className="access-key-textbox" defaultValue={accessKey} size={accessKey.length} readOnly="1" ref={textboxRef} ></input>
                  <button className="access-key-copy-button" onClick={copy}><i className="material-icons">{ copying ? "done" : "notes" }</i></button></div>);
}

// vim:ft=javascript sw=4
