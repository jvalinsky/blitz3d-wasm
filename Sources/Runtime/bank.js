/**
 * Memory Bank System
 *
 * Provides raw memory access operations (Peek/Poke)
 * for Blitz3D compatibility.
 */

const BankSystem = {
  banks: new Map(),
  nextBankId: 1,

  CreateBank(size) {
    const bankId = this.nextBankId++;
    const buffer = new ArrayBuffer(size);
    this.banks.set(bankId, {
      buffer: buffer,
      view: new DataView(buffer),
      size: size,
    });
    return bankId;
  },

  FreeBank(bankId) {
    this.banks.delete(bankId);
  },

  BankSize(bankId) {
    const bank = this.banks.get(bankId);
    return bank ? bank.size : 0;
  },

  PeekByte(bankId, offset) {
    const bank = this.banks.get(bankId);
    return bank ? bank.view.getInt8(offset) : 0;
  },

  PeekShort(bankId, offset) {
    const bank = this.banks.get(bankId);
    return bank ? bank.view.getInt16(offset, true) : 0;
  },

  PeekInt(bankId, offset) {
    const bank = this.banks.get(bankId);
    return bank ? bank.view.getInt32(offset, true) : 0;
  },

  PeekLong(bankId, offset) {
    const bank = this.banks.get(bankId);
    if (!bank) return 0n;
    try {
      return bank.view.getBigInt64(offset, true);
    } catch (e) {
      return 0n;
    }
  },

  PeekFloat(bankId, offset) {
    const bank = this.banks.get(bankId);
    return bank ? bank.view.getFloat32(offset, true) : 0.0;
  },

  PeekDouble(bankId, offset) {
    const bank = this.banks.get(bankId);
    return bank ? bank.view.getFloat64(offset, true) : 0.0;
  },

  PokeByte(bankId, offset, value) {
    const bank = this.banks.get(bankId);
    if (bank) bank.view.setInt8(offset, value);
  },

  PokeShort(bankId, offset, value) {
    const bank = this.banks.get(bankId);
    if (bank) bank.view.setInt16(offset, value, true);
  },

  PokeInt(bankId, offset, value) {
    const bank = this.banks.get(bankId);
    if (bank) bank.view.setInt32(offset, value, true);
  },

  PokeLong(bankId, offset, value) {
    const bank = this.banks.get(bankId);
    if (bank) {
      try {
        bank.view.setBigInt64(offset, value, true);
      } catch (e) {
      }
    }
  },

  PokeFloat(bankId, offset, value) {
    const bank = this.banks.get(bankId);
    if (bank) bank.view.setFloat32(offset, value, true);
  },

  PokeDouble(bankId, offset, value) {
    const bank = this.banks.get(bankId);
    if (bank) bank.view.setFloat64(offset, value, true);
  },

  PeekString(bankId, offset) {
    const bank = this.banks.get(bankId);
    if (!bank) return "";
    let str = "";
    const view = bank.view;
    const len = bank.size;
    for (let i = offset; i < len; i++) {
      const ch = view.getUint8(i);
      if (ch === 0) break;
      str += String.fromCharCode(ch);
    }
    return str;
  },

  PokeString(bankId, offset, value) {
    const bank = this.banks.get(bankId);
    if (!bank) return;
    const view = bank.view;
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
    view.setUint8(offset + value.length, 0);
  },

  CopyBank(srcBankId, srcOffset, dstBankId, dstOffset, count) {
    const src = this.banks.get(srcBankId);
    const dst = this.banks.get(dstBankId);
    if (!src || !dst) return;
    const srcView = new Uint8Array(src.buffer);
    const dstView = new Uint8Array(dst.buffer);
    for (let i = 0; i < count; i++) {
      dstView[dstOffset + i] = srcView[srcOffset + i];
    }
  },
};

window.BankSystem = BankSystem;
