/**
 * INI File System
 * 
 * Key-value storage with persistence to localStorage.
 */

const INISystem = {
    files: new Map(),
    
    parse(content) {
        const result = {};
        let currentSection = 'DEFAULT';
        result[currentSection] = {};
        
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                currentSection = trimmed.slice(1, -1);
                result[currentSection] = {};
            } else if (trimmed.includes('=') && !trimmed.startsWith(';')) {
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('=').trim();
                result[currentSection][key.trim()] = value;
            }
        }
        return result;
    },
    
    stringify(data) {
        const lines = [];
        for (const [section, keys] of Object.entries(data)) {
            lines.push(`[${section}]`);
            for (const [key, value] of Object.entries(keys)) {
                lines.push(`${key}=${value}`);
            }
            lines.push('');
        }
        return lines.join('\n');
    },
    
    GetINIInt(file, section, key) {
        const val = this.GetINIString(file, section, key);
        return val ? parseInt(val, 10) : 0;
    },
    
    GetINIFloat(file, section, key) {
        const val = this.GetINIString(file, section, key);
        return val ? parseFloat(val) : 0.0;
    },
    
    GetINIString(file, section, key) {
        if (!this.files.has(file)) {
            this._loadFile(file);
        }
        const data = this.files.get(file);
        return data?.[section]?.[key] ?? '';
    },
    
    SetINIInt(file, section, key, value) {
        this.SetINIString(file, section, key, value.toString());
    },
    
    SetINIFloat(file, section, key, value) {
        this.SetINIString(file, section, key, value.toString());
    },
    
    SetINIString(file, section, key, value) {
        if (!this.files.has(file)) {
            this.files.set(file, {});
        }
        const data = this.files.get(file);
        if (!data[section]) data[section] = {};
        data[section][key] = value;
        this._saveToStorage(file);
    },
    
    _loadFile(file) {
        const data = VFS.readString(file);
        if (data) {
            this.files.set(file, this.parse(data));
        } else {
            this.files.set(file, {});
        }
    },
    
    _saveToStorage(file) {
        try {
            const key = `ini_${file}`;
            const data = this.files.get(file);
            localStorage.setItem(key, this.stringify(data));
        } catch (e) {
            console.warn('Failed to save INI to localStorage:', e);
        }
    },
    
    HasINIFile(file) {
        if (this.files.has(file)) return true;
        return VFS.fileExists(file);
    }
};

window.INISystem = INISystem;
