const fs = require('fs');
const path = require('path');
const file = 'src/core/events_data.js';
let content = fs.readFileSync(file, 'utf8');

const imagesDir = 'assets/images/events';
if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir);
    let matched = 0;
    files.forEach(f => {
        if(f.endsWith('.png')) {
            const id = f.replace('evt_', '').replace('.png', '');
            const regex = new RegExp(`(id:\\s*'${id}',\\s*\\n\\s*)(title:)`, 'g');
            content = content.replace(regex, `$1image: 'assets/images/events/${f}',\n        $2`);
            matched++;
        }
    });
    fs.writeFileSync(file, content);
    console.log(`Updated events_data.js with ${matched} images`);
} else {
    console.log("Images directory not found.");
}
