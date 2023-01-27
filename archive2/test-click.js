const doc = eval('document')

for (const el of doc.querySelectorAll('p')) {
    if (el.textContent.includes('City')) {
        el.click()
    }
}

for (const el of doc.querySelectorAll('span')) {
    if (el.ariaLabel && el.ariaLabel.includes('Alpha Enterprises')) {
        el.click()
    }
}


for (const el of doc.querySelectorAll('button')) {
    if (el.textContent.includes('TOR Router')) {
        el.click()
    }
}

for (const el of doc.querySelectorAll('p')) {
    if (el.textContent.includes('Terminal')) {
        el.click()
    }
}
