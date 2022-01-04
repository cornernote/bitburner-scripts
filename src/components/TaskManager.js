import {BaseComponent} from "/components/BaseComponent";

/**
 * TaskManager
 *
 * Runs script and payload tasks, and awaits their completion.
 *
 * @RAM 1.1GB
 * - 1.0 GB for ns.run()
 * - 0.1 GB for ns.isRunning()
 */
export class TaskManager extends BaseComponent {

    /**
     * @type {boolean}
     */
    verbose

    /**
     * Construct the component
     * @param {Application} app - the application instance created in the entry script
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(app, config = {}) {
        super(app, config);
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value);
    }

    /**
     * Calls an NS method as a background payload
     *
     * @param nsMethod
     * @param args
     * @returns {Promise<*>}
     */
    async backgroundNS(nsMethod, ...args) {
        return await this.runBackgroundPayload([
            `output = ns.${nsMethod}(${Object.values(args).map(a => JSON.stringify(a)).join(", ")});`,
        ].join("\n"));
    }

    /**
     * Executes an existing script file.
     *
     * The payload is written to a temporary Application js file, which is run using `ns.run()`.
     *
     * @param {String} filename
     * @param {Number} numThreads
     * @param args
     * @returns {Promise<*>}
     */
    async runBackgroundScript(filename, numThreads, ...args) {
        // run the task, and wait for it to complete
        let pid = this.app.ns.run(filename);
        if (this.verbose) {
            this.app.logger.log(`task RUN was started for uuid ${uuid} with pid ${pid}`, true);
        }
        await this.waitForProcessToComplete(pid);
    }

    /**
     * Executes an arbitrary payload using a temporary script file.
     *
     * The payload is written to a temporary Application js file, which is run using `ns.run()`.
     *
     * @param {String} payload
     * ```
     * [
     *    'await ns.sleep(5000);', // do something random...
     *    'output = ns.getPlayer();', // set 'output = ...', so something gets written to cache
     * ].join("\n");
     * ```
     * @param {Boolean} cleanup
     * @returns {Promise<*>} to the contents of the `output` variable in the payload
     */
    async runBackgroundPayload(payload, cleanup = false) {

        // write the payload to a temp Application js file
        let uuid = this.app.stringHelper.generateUUID();
        if (this.verbose) {
            this.app.logger.log(`task PREPARE was started for uuid ${uuid}`, true);
        }
        let filename = `/tasks/${uuid}.js`;
        let contents = [ // the Application js template
            ['import {', 'Application', '} from', '"./includes/Application"', ';'].join(' '), // join() to prevent game rewriting to `blob:file:///bla`
            'export async function main(ns) {',
            '    let app = new Application(ns);',
            '    // execute the payload',
            '    let output = "";',
            payload,
            '    // save the output of the payload the uuid cache when the temp js runs',
            `    app.cache.setItem('${uuid}', output);`,
            `    if (${this.verbose}) app.logger.log('task RUN was completed for uuid ${uuid}', true);`,
            '}',
        ].join("\n");
        await this.app.ns.write(filename, [contents], 'w');

        // run the task, and wait for it to complete
        let pid = this.app.ns.run(filename); // @RAM 1.0GB
        if (this.verbose) {
            this.app.logger.log(`task RUN was started for uuid ${uuid} with pid ${pid}`, true);
        }
        await this.waitForProcessToComplete(pid);

        // get the output from cache
        let output = this.app.cache.getItem(uuid);
        if (this.verbose) {
            this.app.logger.log(`task OUTPUT was collected for uuid ${uuid}: ${JSON.stringify(output)}`, true);
        }

        // cleanup the cache and task file
        if (cleanup) {

            // cleanup cache
            this.app.cache.removeItem(uuid);

            // cleanup temp file
            // this.app.ns.rm(filename); //@RAM 1GB, prefer to run as a sub-script, see below
            pid = this.app.ns.run('task-rm.js', 1, uuid); // @RAM +0 as we already call this!  =)
            if (this.verbose) {
                this.app.logger.log(`task CLEANUP was started for uuid ${uuid} with pid ${pid}`, true);
            }
            await this.waitForProcessToComplete(pid);
        }

        // task done!
        return output;
    }

    /**
     * Wait for a process id to complete running
     * @param {int} pid - The process id to monitor
     **/
    async waitForProcessToComplete(pid) {
        return await this.waitForProcessToComplete_Custom(this.app.ns.isRunning, pid);
    }

    /**
     * An advanced version of waitForProcessToComplete that lets you pass your own "isAlive" test to reduce RAM requirements (e.g. to avoid referencing ns.isRunning)
     * Importing incurs 0 GB RAM (assuming fnIsAlive is implemented using another ns function you already reference elsewhere like ns.ps)
     * @param {int} pid - The process id to monitor
     * @param {function} fnIsAlive - A single-argument function used to start the new script, e.g. `ns.isRunning` or `pid => ns.ps("home").some(process => process.pid === pid)`
     **/
    async waitForProcessToComplete_Custom(fnIsAlive, pid) {
        // Wait for the PID to stop running (cheaper than e.g. deleting (rm) a possibly pre-existing file and waiting for it to be recreated)
        for (let retries = 0; retries < 1000; retries++) {
            if (!fnIsAlive(pid))
                break; // Script is done running
            if (this.verbose && retries % 100 === 0)
                this.app.logger.log(`Waiting for pid ${pid} to complete... (${retries})`, true);
            await this.app.ns.sleep(10);
        }
        // Make sure that the process has shut down, and we haven't just stopped retrying
        if (fnIsAlive(pid)) {
            let errorMessage = `run-command pid ${pid} is running much longer than expected. Max retries exceeded.`;
            this.app.logger.log(errorMessage, true);
            throw errorMessage;
        }
    }

}
