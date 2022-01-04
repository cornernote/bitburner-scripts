import {BaseComponent} from "/includes/BaseComponent";

/**
 * StringHelper
 */
export class StringHelper extends BaseComponent {

    /**
     * Construct the component
     *
     * @param {Application} app - The application instance created in your script's main entry point
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(app, config = {}) {
        super(app, config);
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value);
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