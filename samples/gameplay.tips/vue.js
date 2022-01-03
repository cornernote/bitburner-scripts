/**
 * https://gameplay.tips/guides/bitburner-how-to-run-vue-apps-within-bitburner.html
 */

let _window = eval('window')
let _document = eval('document')
let vueAppId = 'vueApp'

let appStyles = `
.app_root {
    color: white;
    font-family: "Lucida Console", "Lucida Sans Unicode", "Fira Mono", Consolas, "Courier New", Courier, monospace, "Times New Roman";
    .layout {
        z-index: 1500;
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        display: flex;
        pointer-events: none;
    }
    .inner {
        width: 100%;
        margin: 10vh 20vw;
        padding: 1em;
        
        background-color: fade-out(darkslategray, 0.1);
        pointer-events: auto;
    }
    .longform_typography {
        h2 {
            font-size: 32px;
            margin-bottom: 20px;
        }
        code {
            padding: 0.25em 0.4em;
            border-radius: 10px;
            font-family: inherit;
            background-color: black;
            color: lawngreen;
        }
        p {
            font-size: 16px;
            margin-bottom: 20px;
        }
    }
    .trigger {
        z-index: 1500;
        position: fixed;
        bottom: 0.5em;
        left: 1em;
        width: auto;
        height: auto;
        padding: 0.5em;
        margin: 0;
        background-color: white;
        button {
            background-color: black;
            color: currentColor;
            font-weight: bold;
            border: none;
            padding: 0.5em 1em;
        }
    }
}
`

/** @param {NS} ns **/
export async function main(ns) {
    let app = _window._vueApp || null

    if (!_window.Vue) {
        _window.Vue = await import('https://cdn.jsdelivr.net/npm/vue@3.2.26/dist/vue.esm-browser.js')
    }

    if (app) {
        try {
            app.unmount()
            _document.querySelectorAll(`#${vueAppId}-wrap`).forEach(x => x.remove())
        } catch (error) {
            console.log(`Issue unmounting _window._vueApp:`, error)
        }
    }

    // Build Vue app container in DOM
    let body = _document.querySelector('body')
    body.insertAdjacentHTML('afterbegin', `
        <div id='${vueAppId}-wrap'>
            <div id='${vueAppId}'>
                <app-root />
            </div>
            <style type='text/scss'>${appStyles}</style>
        </div>
    `)

    // Create Vue app
    app = Vue.createApp({})

    // Define Vue components
    app.component('app-root', {
        data() {
            return {
                count: 0,
                isOpen: false,
            }
        },
        computed: {
            toggleWorld() {
                return this.isOpen ? 'Close' : 'Open'
            }
        },
        template: `
            <div class='app_root'>
                <div class='layout' v-show='isOpen'>
                    <div class='inner'>
                        <div class='longform_typography'>
                            <h2>Hello From <code>Vue</code>, What Will You Do?</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Pretium vulputate sapien nec sagittis aliquam malesuada bibendum arcu. Sagittis eu volutpat odio facilisis mauris sit amet. Aliquam vestibulum morbi blandit cursus risus at ultrices mi. Mauris vitae ultricies leo integer malesuada nunc. Lacus vestibulum sed arcu non odio euismod lacinia. Nunc mattis enim ut tellus elementum sagittis vitae et leo. Aliquet enim tortor at auctor urna nunc id cursus metus. Pellentesque nec nam aliquam sem et tortor consequat. Morbi enim nunc faucibus a pellentesque sit amet. Sagittis vitae et leo duis ut diam quam nulla.
                            </p>
                            <p>
                                Sit amet nisl suscipit adipiscing bibendum est. In ornare quam viverra orci sagittis eu volutpat odio facilisis. Dolor magna eget est lorem. In massa tempor nec feugiat nisl pretium fusce id. Laoreet suspendisse interdum consectetur libero id faucibus. Elementum curabitur vitae nunc sed velit dignissim. Urna nec tincidunt praesent semper feugiat nibh sed. Semper risus in hendrerit gravida rutrum quisque non. Praesent tristique magna sit amet purus. Amet est placerat in egestas erat imperdiet sed euismod nisi. Tincidunt arcu non sodales neque sodales ut etiam. Nullam eget felis eget nunc.
                            </p>
                        </div>
                    </div>
                </div>
                <div class='trigger'>
                    <button @click="toggleDisplay">
                        {{toggleWorld}} Vue App
                    </button>
                </div>
            </div>
        `,
        methods: {
            toggleDisplay() {
                this.isOpen = !this.isOpen
            }
        }
    })

    // Mount Vue app
    app.mount(`#${vueAppId}`)

    // Add SCSS compiler for in-browser compilation (kekw)
    addScssCompiler()

    _window._vueApp = app

    return app
}

function addScssCompiler() {

    function findAndConvertTags() {
        // Restore `window.define`
        _window.define = _window._defineBak
        var sassTags = _document.getElementsByTagName('style');
        for (var i = sassTags.length - 1; i >= 0; i--) {
            if (sassTags[i].type.toLowerCase() === 'text/scss' && sassTags[i]._scssCompiled !== true) {
                Sass.compile(sassTags[i].innerHTML, function (compiledCSS) {
                    var rawStyle = _document.createElement('style');
                    rawStyle.type = 'text/css';
                    rawStyle.innerHTML = compiledCSS.text;
                    _document.getElementById(`${vueAppId}-wrap`).appendChild(rawStyle);
                });
                sassTags[i]._scssCompiled = true
            }
        }
    }

    if (typeof _window !== 'undefined' && typeof _document !== 'undefined') {
        if (typeof Sass === 'undefined' || typeof Sass.compile !== 'function') {
            var sassJSScript = _document.createElement('script');
            sassJSScript.type = 'text/javascript';
            sassJSScript.src = 'https://cdn.jsdelivr.net/npm/sass.js@0.11.1/dist/sass.sync.js';
            sassJSScript.onload = findAndConvertTags;

            // Monkey patch `window.define` to ensure sass installs properly
            _window._defineBak = _window.define
            _window.define = undefined
            _document.head.appendChild(sassJSScript);
        } else {
            findAndConvertTags();
        }

        if (typeof _window !== 'undefined' && _window !== null && typeof Sass !== 'undefined' && typeof Sass.compile === 'function') {
            setTimeout(findAndConvertTags, 0);
        }
    }
}