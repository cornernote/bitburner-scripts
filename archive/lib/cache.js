/**
 * Cache
 *
 * Uses localStorage to store and retrieve cached data.
 * - Automatically stringify/parse data before and after saving.
 * - Allows data to expire after a given time.
 */
export const cache = {

    /**
     * Returns the current value associated with the given key, or null if the given key does not exist.
     * @param key
     * @returns {any}
     */
    getItem(key) {
        let contents = localStorage.getItem(key)
        if (contents) {
            let data = JSON.parse(contents)
            if (!data.expires || data.expires > new Date().getTime()) {
                return data.value
            }
        }
        return undefined
    },

    /**
     * Sets the value of the pair identified by key to value, creating a new key/value pair if none existed for key previously.
     * @param key
     * @param value
     * @param expires in milliseconds, 0 = forever
     */
    setItem(key, value, expires) {
        let data = {
            expires: expires ? new Date().getTime() + expires : 0,
            value: typeof value === 'function' ? value() : value, // if value is a function then use the returned value
        }
        let contents = JSON.stringify(data)
        localStorage.setItem(key, contents)
    },

    /**
     * Removes the key/value pair with the given key, if a key/value pair with the given key exists.
     * @param key
     */
    removeItem(key) {
        localStorage.removeItem(key)
    },

    /**
     * Removes all key/value pairs, if there are any.
     */
    clear() {
        localStorage.clear()
    },

}