// --- JSKit Glue ---
// This is the glue code that allows Swift code compiled with JavaScriptKit
// to interact with the JavaScript environment.

function createJavaScriptKitImports(memory) {
  const textDecoder = new TextDecoder("utf-8");
  const textEncoder = new TextEncoder("utf-8");
  let JSKit_obj_storage = {};
  let JSKit_obj_id_counter = 1;

  const readString = (ptr) => {
    const buffer = new Uint8Array(memory.buffer, ptr);
    let end = 0;
    while (buffer[end] !== 0) end++;
    return textDecoder.decode(buffer.slice(0, end));
  };

  const writeString = (str, ptr) => {
    const bytes = textEncoder.encode(str);
    new Uint8Array(memory.buffer, ptr, bytes.length).set(bytes);
    return bytes.length;
  };

  return {
    // --- Value Creation ---
    _JSValueMakeNumber: (value) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = value;
      return id;
    },
    _JSValueMakeString: (ptr) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = readString(ptr);
      return id;
    },
    _JSValueMakeBoolean: (value) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = !!value;
      return id;
    },
    _JSValueMakeNull: () => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = null;
      return id;
    },
    _JSValueMakeUndefined: () => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = undefined;
      return id;
    },
    _JSValueMakeObject: () => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = {};
      return id;
    },

    // --- Value Getters ---
    _JSValueGetNumber: (id, ptr) => {
      const value = JSKit_obj_storage[id];
      if (typeof value === "number") {
        new DataView(memory.buffer).setFloat64(ptr, value, true);
      }
    },
    _JSValueGetString: (id, ptr) => {
      const value = JSKit_obj_storage[id];
      if (typeof value === "string") {
        return writeString(value, ptr);
      }
      return 0;
    },
    _JSValueGetBoolean: (id) => {
      return JSKit_obj_storage[id] ? 1 : 0;
    },

    // --- Function Calls & Properties ---
    _JSValueCall: (id, args_ptr, args_len) => {
      const func = JSKit_obj_storage[id];
      // Simplified: assumes `this` is global and no args
      const result = func();
      const result_id = JSKit_obj_id_counter++;
      JSKit_obj_storage[result_id] = result;
      return result_id;
    },
    _JSValueGetProperty: (id, prop_ptr) => {
      const obj = JSKit_obj_storage[id];
      const prop = readString(prop_ptr);
      const result = obj[prop];
      const result_id = JSKit_obj_id_counter++;
      JSKit_obj_storage[result_id] = result;
      return result_id;
    },
    _JSValueSetProperty: (id, prop_ptr, value_id) => {
      const obj = JSKit_obj_storage[id];
      const prop = readString(prop_ptr);
      obj[prop] = JSKit_obj_storage[value_id];
    },

    // --- Memory Management ---
    _JSValueDelete: (id) => {
      delete JSKit_obj_storage[id];
    },

    // --- Type Checks ---
    _JSValueIsNumber: (id) => typeof JSKit_obj_storage[id] === "number",
    _JSValueIsString: (id) => typeof JSKit_obj_storage[id] === "string",
    _JSValueIsBoolean: (id) => typeof JSKit_obj_storage[id] === "boolean",
    _JSValueIsNull: (id) => JSKit_obj_storage[id] === null,
    _JSValueIsUndefined: (id) => JSKit_obj_storage[id] === undefined,
    _JSValueIsObject: (id) =>
      typeof JSKit_obj_storage[id] === "object" &&
      JSKit_obj_storage[id] !== null,
    _JSValueIsFunction: (id) => typeof JSKit_obj_storage[id] === "function",
    _JSValueIsSymbol: (id) => typeof JSKit_obj_storage[id] === "symbol",

    // --- Swift -> JS Bridge Helpers ---
    swjs_i64_to_bigint_slow: (lower, upper) => {
      // Combine two 32-bit integers into a 64-bit BigInt
      const low = BigInt.asUintN(32, BigInt(lower));
      const high = BigInt.asUintN(32, BigInt(upper));
      const result = (high << 32n) | low;
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = result;
      return id;
    },
    swjs_create_function: (host_func_id, line, file) => {
      // Stub: return a dummy function object
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = () => {
        console.warn("Called a stubbed JSKit function");
      };
      return id;
    },
    swjs_call_new: (obj_id, args_ptr, args_len) => {
      // Stub: return a new dummy object
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = { _isStub: true };
      return id;
    },
    swjs_call_function: (obj_id, func_id, args_ptr, args_len) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = undefined;
      return id;
    },
    swjs_call_function_no_catch: (obj_id, func_id, args_ptr, args_len) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = undefined;
      return id;
    },
    swjs_get_prop: (obj_id, prop_ptr) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = undefined;
      return id;
    },
    swjs_set_prop: (obj_id, prop_ptr, value_id) => {},
    swjs_instanceof: (obj_id, class_id) => false,
    swjs_call_function_with_this: (obj_id, func_id, args_ptr, args_len) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = undefined;
      return id;
    },
    swjs_call_function_with_this_no_catch: (
      obj_id,
      func_id,
      args_ptr,
      args_len,
    ) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = undefined;
      return id;
    },
    swjs_release: (obj_id) => {
      delete JSKit_obj_storage[obj_id];
    },
    swjs_decode_string: (ptr, len) => {
      const str = textDecoder.decode(new Uint8Array(memory.buffer, ptr, len));
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = str;
      return id;
    },
    swjs_encode_string: (id, ptr) => {
      const value = JSKit_obj_storage[id];
      if (typeof value === "string") {
        return writeString(value, ptr);
      }
      return 0;
    },
    swjs_load_string: (ptr) => {
      const str = readString(ptr);
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = str;
      return id;
    },
    swjs_call_throwing_new: (obj_id, args_ptr, args_len, exception_obj_ptr) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = { _isStub: true };
      return id;
    },
    swjs_call_throwing_function: (
      obj_id,
      func_id,
      args_ptr,
      args_len,
      exception_obj_ptr,
    ) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = undefined;
      return id;
    },
    swjs_call_throwing_function_with_this: (
      obj_id,
      func_id,
      args_ptr,
      args_len,
      exception_obj_ptr,
    ) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = undefined;
      return id;
    },
    swjs_create_typed_array: (
      constructor_id,
      ptr,
      length,
      release_callback_id,
    ) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = new Uint8Array(length);
      return id;
    },
    swjs_load_typed_array: (obj_id, ptr_ptr, len_ptr) => {
      // Stub
      return 0;
    },
    swjs_get_subscript: (obj_id, subscript_id) => {
      const id = JSKit_obj_id_counter++;
      JSKit_obj_storage[id] = undefined;
      return id;
    },
    swjs_set_subscript: (obj_id, subscript_id, value_id) => {},
  };
}
