import {BaseComponent} from "/includes/BaseComponent";
import {TaskManager} from "/includes/TaskManager";

/**
 * BackgroundNS
 *
 * Allows execution of background tasks to save RAM in the foreground task.
 *
 * @RAM 1.1GB
 */
export class BackgroundNS extends BaseComponent {

    taskManager = null;

    /**
     * @param app
     * @param options
     */
    constructor(app, options = {}) {
        super(app, options);

        // set components
        this.taskManager = new TaskManager(app); //@RAM 1.1GB

        // allow override of properties in this class
        Object.entries(options).forEach(([key, value]) => this[key] = value);
    }


    /**
     * Get information about the player.
     *
     * Returns an object with information on the current player.
     *
     * @param {Number} expires
     * @returns {Object} Player info
     */
    async getPlayer(expires = 1000) {
        return await this.callNS('getPlayer');
    }

    /**
     * Calls an NS method
     *
     * @param nsMethod
     * @param args
     * @returns {Promise<*>}
     */
    async callNS(nsMethod, ...args) {
        return await this.taskManager.runBackgroundPayload([
            `output = ns.${nsMethod}();`,
        ].join("\n"))
    }

    /**
     * Calls an NS method and caches the output
     *
     * @param nsMethod
     * @param cacheKey
     * @param expires
     * @param args
     * @returns {Promise<*>}
     */
    async callNSCache(cacheKey, expires, nsMethod, ...args) {
        let output = this.app.cache.getItem(cacheKey);
        if (output === undefined) {
            output = await this.callNS(nsMethod, ...args)
            this.app.cache.setItem(cacheKey, output, expires);
        }
        return output;
    }

}
