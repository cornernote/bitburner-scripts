import {cache} from "/lib/cache";

/**
 * Runner
 *
 * Runs scripts and payload strings as sub-tasks, and awaits their completion.
 * Retrieves output from sub-tasks using cache.
 * This is typically used to save RAM cost in the foreground script.
 *
 * @RAM 1.1GB
 * - 1.0GB ns.run()
 * - 0.1GB ns.isRunning()
 */
export class Runner {

    /**
     * @type {NS}
     */
    ns = null

    /**
     * Construct the class
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, config = {}) {
        this.ns = ns;
        Object.entries(config).forEach(([key, value]) => this[key] = value); // allow override of properties in this class
    }

    /**
     * Calls an NS method as a background payload
     *
     * @param nsMethod
     * @param args
     * @returns {Promise<*>}
     */
    async runNS(nsMethod, ...args) {
        return await this.runPayload([
            `output = ns.${nsMethod}(${Object.values(args).map(a => JSON.stringify(a)).join(", ")});`,
        ].join("\n"));
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
        let pid = this.ns.run(filename);
        await this.waitForPid(pid);
    }

    /**
     * Executes an arbitrary payload using a temporary script file.
     *
     * The payload is written to a temporary js file, which is run using `ns.run()`.
     *
     * @param {String} payload
     * ```
     * [
     *    'await ns.sleep(5000);', // do something random...
     *    'output = ns.getPlayer();', // set 'output = ...', so something gets written to cache
     * ].join("\n");
     * ```
     * @returns {Promise<*>} to the contents of the `output` variable in the payload
     */
    async runPayload(payload) {

        // write the payload to a temp js file
        let uuid = this.generateUUID();
        let filename = `/runners/${uuid}.js`;
        let contents = [ // the js template
            ['import {', 'cache', '} from', '"./lib/cache"', ';'].join(' '), // join() to prevent game rewriting to `blob:file:///bla`
            'export async function main(ns) {',
            '    // execute the payload',
            '    let output = "";',
            payload,
            '    // save the output of the payload the uuid cache when the temp js runs',
            `    cache.setItem('runner-${uuid}', output);`,
            `    ns.print('task RUN was completed for uuid ${uuid}');`,
            '}',
        ].join("\n");
        await this.ns.write(filename, [contents], 'w');

        // run the task, and wait for it to complete
        let pid = this.ns.run(filename); // @RAM 1.0GB
        await this.waitForPid(pid);

        // get the output from cache
        let output = cache.getItem(`runner-${uuid}`);

        // cleanup cache
        cache.removeItem(uuid);

        // cleanup temp file
        // this.ns.rm(filename); // prefer to run as a sub-task and save 1GB RAM
        await this.runScript('/scripts/runner-rm.js', 1, uuid);

        // task done!
        return output;
    }

    /**
     * Wait for a process id to complete running
     * @param {int} pid - The process id to monitor
     **/
    async waitForPid(pid) {
        for (let retries = 0; retries < 1000; retries++) {
            if (!this.ns.isRunning(pid))
                break; // Script is done running
            await this.ns.sleep(10);
        }
        // Make sure that the process has shut down, and we haven't just stopped retrying
        if (this.ns.isRunning(pid)) {
            throw `run-command pid ${pid} is running much longer than expected. Max retries exceeded.`;
        }
    }

    /**
     * Generate a UUIDv4 string
     * @returns {string}
     */
    generateUUID() {
        let dt = new Date().getTime();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = (dt + Math.random() * 16) % 16 | 0
            dt = Math.floor(dt / 16)
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
        });
    }
}
