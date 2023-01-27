/**
 * Runner
 *
 * Runs scripts and payload strings as sub-tasks, and awaits their completion.
 * Retrieves output from sub-tasks using localStorage.
 * This is typically used to save RAM cost in the foreground script.
 *
 * @RAM 1.1GB
 * - 1.0GB ns.run()
 * - 0.1GB ns.isRunning()
 * - also note the background task will cost 1.6GB, plus any function memory required for the background script to run
 *
 * Basic usage, to run NS methods in the background:
 * ```
 * const runner = new Runner(ns)
 * const server1 = await runner.nsProxy.getServer('n00dles') // but the game will still count for RAM in the foreground script
 * const server2 = await runner.nsProxy['getServer']('n00dles') // use this to run in the background, releasing ram
 * ```
 *
 * Note, to avoid runtime ram errors, if you use the proxy you should have fake calls to the above functions. EG:
 * ```
 * function countedTowardsMemory(ns) {
 *    ns.run()
 *    ns.isRunning(0)
 * }
 * ```
 */
export class Runner {

    /**
     * @type {NS}
     */
    ns = null

    /**
     * @type {NS|Proxy|*}
     */
    nsProxy = null

    /**
     * @type {NS|Proxy|*}
     */
    nsAsyncProxy = null

    /**
     * @type {Hacknet|Proxy|*}
     */
    hacknetProxy = null

    /**
     * Construct the class
     *
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, config = {}) {
        this.ns = ns
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value)
        // add a proxy to allow calls to undefined methods, which forward to this.runNS()
        let that = this
        if (!this.nsProxy) {
            this.nsProxy = new Proxy({}, {
                get(target, name) {
                    return function () {
                        return that.runNs(name, arguments)
                    }
                },
            })
        }
        if (!this.nsAsyncProxy) {
            this.nsAsyncProxy = new Proxy({}, {
                async get(target, name) {
                    return async function () {
                        return await that.runNsAsync(name, arguments)
                    }
                },
            })
        }
        if (!this.hacknetProxy) {
            this.hacknetProxy = new Proxy({}, {
                get(target, name) {
                    return async function () {
                        return await that.runHacknet(name, arguments)
                    }
                },
            })
        }
    }

    /**
     * Calls an NS method as a background payload
     *
     * @param method
     * @param args
     * @returns {Promise<*>}
     */
    async runNs(method, ...args) {
        return await this.runPayload([
            `output = ns.${method}(${Object.values(...args).map(a => JSON.stringify(a)).join(", ")})`,
        ].join("\n"), `ns-${method}-`)
    }

    /**
     * Calls an NS method as a background payload
     *
     * @param method
     * @param args
     * @returns {Promise<*>}
     */
    async runNsAsync(method, ...args) {
        return await this.runPayload([
            `output = await ns.${method}(${Object.values(...args).map(a => JSON.stringify(a)).join(", ")})`,
        ].join("\n"), `ns-${method}-`)
    }

    /**
     * Calls a Hacknet method as a background payload
     *
     * @param method
     * @param args
     * @returns {Promise<*>}
     */
    async runHacknet(method, ...args) {
        return await this.runPayload([
            // find a way to detect if we need to await, or just await all...
            `output = await ns.hacknet.${method}(${Object.values(...args).map(a => JSON.stringify(a)).join(", ")})`,
        ].join("\n"), `hacknet-${method}-`)
    }

    /**
     * Executes an existing script file.
     *
     * The payload is written to a temporary js file, which is run using `ns.run()`.
     *
     * @param {String} filename
     * @param {Number} numThreads
     * @param args
     * @returns {Promise<*>}
     */
    async runScript(filename, numThreads, ...args) {
        // run the task, and wait for it to complete
        let retry = 5,
            pid = 0
        for (let i = retry; i > 0; i--) {
            pid = this.ns['run'](filename, numThreads, ...args)
            if (pid) {
                break
            }
            await this.ns.sleep(100)
        }
        if (!pid) {
            throw `Could not run process ${filename}, not enough RAM?`
        }
        await this.waitForPid(pid)
    }

    /**
     * Executes an arbitrary payload using a temporary script file.
     *
     * The payload is written to a temporary js file, which is run using `ns.run()`.
     *
     * @param {String} payload the payload to run
     * ```
     * [
     *    'await ns.sleep(5000)', // do something random...
     *    'output = ns.getPlayer()', // set 'output = ...', so something gets written to localStorage
     * ].join("\n")
     * ```
     * @param {String} filePrefix the prefix to use for the temp file
     * @returns {Promise<*>} to the contents of the `output` variable in the payload
     */
    async runPayload(payload, filePrefix = '') {

        // write the payload to a temp js file
        let uuid = this.generateUUID()
        let filename = `/runner/${filePrefix}${uuid}.js`
        let contents = [ // the js template
            'export async function main(ns) {',
            '    // execute the payload',
            '    let output = ""',
            payload,
            '    // save the output of the payload the uuid localStorage when the temp js runs',
            `    localStorage.setItem('runner-${filePrefix}${uuid}', JSON.stringify(output))`,
            `    ns.print('task RUN was completed for ${filePrefix}${uuid}')`,
            '}',
        ].join("\n")
        this.ns.write(filename, contents, 'w')

        // run the task, and wait for it to complete
        let pid = this.ns['run'](filename, 1, filePrefix) // @RAM 1.0GB
        if (!pid) {
            throw `Could not start process ${filePrefix}${uuid}, not enough RAM?`
        }
        await this.waitForPid(pid)

        // get the output from localStorage
        let output = JSON.parse(localStorage.getItem(`runner-${filePrefix}${uuid}`))

        // cleanup
        await this.cleanup(filePrefix, uuid)

        // task done!
        return output
    }

    /**
     * Cleanup runner file and localstorage output
     * @param filePrefix
     * @param uuid
     * @returns {Promise<void>}
     */
    async cleanup(filePrefix, uuid) {
        // remove from disk
        await this.runScript('/runner/_rm.js', 1, `${filePrefix}${uuid}`)
        // remove from local storage
        localStorage.removeItem(uuid)
    }

    /**
     * Wait for a process id to complete running
     * @param {int} pid - The process id to monitor
     **/
    async waitForPid(pid) {
        for (let retries = 0; retries < 1000; retries++) {
            if (!this.ns['isRunning'](pid))
                break // Script is done running
            await this.ns.sleep(10)
        }
        // Make sure that the process has shut down, and we haven't just stopped retrying
        if (this.ns['isRunning'](pid)) {
            throw `run-command pid ${pid} is running much longer than expected. Max retries exceeded.`
        }
    }

    /**
     * Generate a UUIDv4 string
     * @returns {string}
     */
    generateUUID() {
        let dt = new Date().getTime()
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = (dt + Math.random() * 16) % 16 | 0
            dt = Math.floor(dt / 16)
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
        })
    }

}