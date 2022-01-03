import {BaseComponent} from "/includes/BaseComponent";

/**
 * StringHelper
 */
export class StringHelper extends BaseComponent {
    constructor(app, options = {}) {
        super(app, options);
        // allow override of properties in this class
        Object.entries(options).forEach(([key, value]) => this[key] = value);
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