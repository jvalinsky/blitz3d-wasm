export declare const enum SectionCode {
    Unknown = -1,
    Custom = 0,
    Type = 1,
    Import = 2,
    Function = 3,
    Table = 4,
    Memory = 5,
    Global = 6,
    Export = 7,
    Start = 8,
    Element = 9,
    Code = 10,
    Data = 11,
    DataCount = 12,
    Tag = 13
}
export declare const enum OperatorCode {
    unreachable = 0,
    nop = 1,
    block = 2,
    loop = 3,
    if = 4,
    else = 5,
    try = 6,
    catch = 7,
    throw = 8,
    rethrow = 9,
    throw_ref = 10,
    end = 11,
    br = 12,
    br_if = 13,
    br_table = 14,
    return = 15,
    call = 16,
    call_indirect = 17,
    return_call = 18,
    return_call_indirect = 19,
    call_ref = 20,
    return_call_ref = 21,
    let = 23,
    delegate = 24,
    catch_all = 25,
    drop = 26,
    select = 27,
    select_with_type = 28,
    try_table = 31,
    local_get = 32,
    local_set = 33,
    local_tee = 34,
    global_get = 35,
    global_set = 36,
    i32_load = 40,
    i64_load = 41,
    f32_load = 42,
    f64_load = 43,
    i32_load8_s = 44,
    i32_load8_u = 45,
    i32_load16_s = 46,
    i32_load16_u = 47,
    i64_load8_s = 48,
    i64_load8_u = 49,
    i64_load16_s = 50,
    i64_load16_u = 51,
    i64_load32_s = 52,
    i64_load32_u = 53,
    i32_store = 54,
    i64_store = 55,
    f32_store = 56,
    f64_store = 57,
    i32_store8 = 58,
    i32_store16 = 59,
    i64_store8 = 60,
    i64_store16 = 61,
    i64_store32 = 62,
    memory_size = 63,
    memory_grow = 64,
    i32_const = 65,
    i64_const = 66,
    f32_const = 67,
    f64_const = 68,
    i32_eqz = 69,
    i32_eq = 70,
    i32_ne = 71,
    i32_lt_s = 72,
    i32_lt_u = 73,
    i32_gt_s = 74,
    i32_gt_u = 75,
    i32_le_s = 76,
    i32_le_u = 77,
    i32_ge_s = 78,
    i32_ge_u = 79,
    i64_eqz = 80,
    i64_eq = 81,
    i64_ne = 82,
    i64_lt_s = 83,
    i64_lt_u = 84,
    i64_gt_s = 85,
    i64_gt_u = 86,
    i64_le_s = 87,
    i64_le_u = 88,
    i64_ge_s = 89,
    i64_ge_u = 90,
    f32_eq = 91,
    f32_ne = 92,
    f32_lt = 93,
    f32_gt = 94,
    f32_le = 95,
    f32_ge = 96,
    f64_eq = 97,
    f64_ne = 98,
    f64_lt = 99,
    f64_gt = 100,
    f64_le = 101,
    f64_ge = 102,
    i32_clz = 103,
    i32_ctz = 104,
    i32_popcnt = 105,
    i32_add = 106,
    i32_sub = 107,
    i32_mul = 108,
    i32_div_s = 109,
    i32_div_u = 110,
    i32_rem_s = 111,
    i32_rem_u = 112,
    i32_and = 113,
    i32_or = 114,
    i32_xor = 115,
    i32_shl = 116,
    i32_shr_s = 117,
    i32_shr_u = 118,
    i32_rotl = 119,
    i32_rotr = 120,
    i64_clz = 121,
    i64_ctz = 122,
    i64_popcnt = 123,
    i64_add = 124,
    i64_sub = 125,
    i64_mul = 126,
    i64_div_s = 127,
    i64_div_u = 128,
    i64_rem_s = 129,
    i64_rem_u = 130,
    i64_and = 131,
    i64_or = 132,
    i64_xor = 133,
    i64_shl = 134,
    i64_shr_s = 135,
    i64_shr_u = 136,
    i64_rotl = 137,
    i64_rotr = 138,
    f32_abs = 139,
    f32_neg = 140,
    f32_ceil = 141,
    f32_floor = 142,
    f32_trunc = 143,
    f32_nearest = 144,
    f32_sqrt = 145,
    f32_add = 146,
    f32_sub = 147,
    f32_mul = 148,
    f32_div = 149,
    f32_min = 150,
    f32_max = 151,
    f32_copysign = 152,
    f64_abs = 153,
    f64_neg = 154,
    f64_ceil = 155,
    f64_floor = 156,
    f64_trunc = 157,
    f64_nearest = 158,
    f64_sqrt = 159,
    f64_add = 160,
    f64_sub = 161,
    f64_mul = 162,
    f64_div = 163,
    f64_min = 164,
    f64_max = 165,
    f64_copysign = 166,
    i32_wrap_i64 = 167,
    i32_trunc_f32_s = 168,
    i32_trunc_f32_u = 169,
    i32_trunc_f64_s = 170,
    i32_trunc_f64_u = 171,
    i64_extend_i32_s = 172,
    i64_extend_i32_u = 173,
    i64_trunc_f32_s = 174,
    i64_trunc_f32_u = 175,
    i64_trunc_f64_s = 176,
    i64_trunc_f64_u = 177,
    f32_convert_i32_s = 178,
    f32_convert_i32_u = 179,
    f32_convert_i64_s = 180,
    f32_convert_i64_u = 181,
    f32_demote_f64 = 182,
    f64_convert_i32_s = 183,
    f64_convert_i32_u = 184,
    f64_convert_i64_s = 185,
    f64_convert_i64_u = 186,
    f64_promote_f32 = 187,
    i32_reinterpret_f32 = 188,
    i64_reinterpret_f64 = 189,
    f32_reinterpret_i32 = 190,
    f64_reinterpret_i64 = 191,
    i32_extend8_s = 192,
    i32_extend16_s = 193,
    i64_extend8_s = 194,
    i64_extend16_s = 195,
    i64_extend32_s = 196,
    prefix_0xfb = 251,
    prefix_0xfc = 252,
    prefix_0xfd = 253,
    prefix_0xfe = 254,
    i32_trunc_sat_f32_s = 64512,
    i32_trunc_sat_f32_u = 64513,
    i32_trunc_sat_f64_s = 64514,
    i32_trunc_sat_f64_u = 64515,
    i64_trunc_sat_f32_s = 64516,
    i64_trunc_sat_f32_u = 64517,
    i64_trunc_sat_f64_s = 64518,
    i64_trunc_sat_f64_u = 64519,
    memory_init = 64520,
    data_drop = 64521,
    memory_copy = 64522,
    memory_fill = 64523,
    table_init = 64524,
    elem_drop = 64525,
    table_copy = 64526,
    table_grow = 64527,
    table_size = 64528,
    table_fill = 64529,
    table_get = 37,
    table_set = 38,
    ref_null = 208,
    ref_is_null = 209,
    ref_func = 210,
    ref_eq = 211,
    ref_as_non_null = 212,
    br_on_null = 213,
    br_on_non_null = 214,
    memory_atomic_notify = 65024,
    memory_atomic_wait32 = 65025,
    memory_atomic_wait64 = 65026,
    atomic_fence = 65027,
    i32_atomic_load = 65040,
    i64_atomic_load = 65041,
    i32_atomic_load8_u = 65042,
    i32_atomic_load16_u = 65043,
    i64_atomic_load8_u = 65044,
    i64_atomic_load16_u = 65045,
    i64_atomic_load32_u = 65046,
    i32_atomic_store = 65047,
    i64_atomic_store = 65048,
    i32_atomic_store8 = 65049,
    i32_atomic_store16 = 65050,
    i64_atomic_store8 = 65051,
    i64_atomic_store16 = 65052,
    i64_atomic_store32 = 65053,
    i32_atomic_rmw_add = 65054,
    i64_atomic_rmw_add = 65055,
    i32_atomic_rmw8_add_u = 65056,
    i32_atomic_rmw16_add_u = 65057,
    i64_atomic_rmw8_add_u = 65058,
    i64_atomic_rmw16_add_u = 65059,
    i64_atomic_rmw32_add_u = 65060,
    i32_atomic_rmw_sub = 65061,
    i64_atomic_rmw_sub = 65062,
    i32_atomic_rmw8_sub_u = 65063,
    i32_atomic_rmw16_sub_u = 65064,
    i64_atomic_rmw8_sub_u = 65065,
    i64_atomic_rmw16_sub_u = 65066,
    i64_atomic_rmw32_sub_u = 65067,
    i32_atomic_rmw_and = 65068,
    i64_atomic_rmw_and = 65069,
    i32_atomic_rmw8_and_u = 65070,
    i32_atomic_rmw16_and_u = 65071,
    i64_atomic_rmw8_and_u = 65072,
    i64_atomic_rmw16_and_u = 65073,
    i64_atomic_rmw32_and_u = 65074,
    i32_atomic_rmw_or = 65075,
    i64_atomic_rmw_or = 65076,
    i32_atomic_rmw8_or_u = 65077,
    i32_atomic_rmw16_or_u = 65078,
    i64_atomic_rmw8_or_u = 65079,
    i64_atomic_rmw16_or_u = 65080,
    i64_atomic_rmw32_or_u = 65081,
    i32_atomic_rmw_xor = 65082,
    i64_atomic_rmw_xor = 65083,
    i32_atomic_rmw8_xor_u = 65084,
    i32_atomic_rmw16_xor_u = 65085,
    i64_atomic_rmw8_xor_u = 65086,
    i64_atomic_rmw16_xor_u = 65087,
    i64_atomic_rmw32_xor_u = 65088,
    i32_atomic_rmw_xchg = 65089,
    i64_atomic_rmw_xchg = 65090,
    i32_atomic_rmw8_xchg_u = 65091,
    i32_atomic_rmw16_xchg_u = 65092,
    i64_atomic_rmw8_xchg_u = 65093,
    i64_atomic_rmw16_xchg_u = 65094,
    i64_atomic_rmw32_xchg_u = 65095,
    i32_atomic_rmw_cmpxchg = 65096,
    i64_atomic_rmw_cmpxchg = 65097,
    i32_atomic_rmw8_cmpxchg_u = 65098,
    i32_atomic_rmw16_cmpxchg_u = 65099,
    i64_atomic_rmw8_cmpxchg_u = 65100,
    i64_atomic_rmw16_cmpxchg_u = 65101,
    i64_atomic_rmw32_cmpxchg_u = 65102,
    v128_load = 1036288,
    i16x8_load8x8_s = 1036289,
    i16x8_load8x8_u = 1036290,
    i32x4_load16x4_s = 1036291,
    i32x4_load16x4_u = 1036292,
    i64x2_load32x2_s = 1036293,
    i64x2_load32x2_u = 1036294,
    v8x16_load_splat = 1036295,
    v16x8_load_splat = 1036296,
    v32x4_load_splat = 1036297,
    v64x2_load_splat = 1036298,
    v128_store = 1036299,
    v128_const = 1036300,
    i8x16_shuffle = 1036301,
    i8x16_swizzle = 1036302,
    i8x16_splat = 1036303,
    i16x8_splat = 1036304,
    i32x4_splat = 1036305,
    i64x2_splat = 1036306,
    f32x4_splat = 1036307,
    f64x2_splat = 1036308,
    i8x16_extract_lane_s = 1036309,
    i8x16_extract_lane_u = 1036310,
    i8x16_replace_lane = 1036311,
    i16x8_extract_lane_s = 1036312,
    i16x8_extract_lane_u = 1036313,
    i16x8_replace_lane = 1036314,
    i32x4_extract_lane = 1036315,
    i32x4_replace_lane = 1036316,
    i64x2_extract_lane = 1036317,
    i64x2_replace_lane = 1036318,
    f32x4_extract_lane = 1036319,
    f32x4_replace_lane = 1036320,
    f64x2_extract_lane = 1036321,
    f64x2_replace_lane = 1036322,
    i8x16_eq = 1036323,
    i8x16_ne = 1036324,
    i8x16_lt_s = 1036325,
    i8x16_lt_u = 1036326,
    i8x16_gt_s = 1036327,
    i8x16_gt_u = 1036328,
    i8x16_le_s = 1036329,
    i8x16_le_u = 1036330,
    i8x16_ge_s = 1036331,
    i8x16_ge_u = 1036332,
    i16x8_eq = 1036333,
    i16x8_ne = 1036334,
    i16x8_lt_s = 1036335,
    i16x8_lt_u = 1036336,
    i16x8_gt_s = 1036337,
    i16x8_gt_u = 1036338,
    i16x8_le_s = 1036339,
    i16x8_le_u = 1036340,
    i16x8_ge_s = 1036341,
    i16x8_ge_u = 1036342,
    i32x4_eq = 1036343,
    i32x4_ne = 1036344,
    i32x4_lt_s = 1036345,
    i32x4_lt_u = 1036346,
    i32x4_gt_s = 1036347,
    i32x4_gt_u = 1036348,
    i32x4_le_s = 1036349,
    i32x4_le_u = 1036350,
    i32x4_ge_s = 1036351,
    i32x4_ge_u = 1036352,
    f32x4_eq = 1036353,
    f32x4_ne = 1036354,
    f32x4_lt = 1036355,
    f32x4_gt = 1036356,
    f32x4_le = 1036357,
    f32x4_ge = 1036358,
    f64x2_eq = 1036359,
    f64x2_ne = 1036360,
    f64x2_lt = 1036361,
    f64x2_gt = 1036362,
    f64x2_le = 1036363,
    f64x2_ge = 1036364,
    v128_not = 1036365,
    v128_and = 1036366,
    v128_andnot = 1036367,
    v128_or = 1036368,
    v128_xor = 1036369,
    v128_bitselect = 1036370,
    v128_any_true = 1036371,
    v128_load8_lane = 1036372,
    v128_load16_lane = 1036373,
    v128_load32_lane = 1036374,
    v128_load64_lane = 1036375,
    v128_store8_lane = 1036376,
    v128_store16_lane = 1036377,
    v128_store32_lane = 1036378,
    v128_store64_lane = 1036379,
    v128_load32_zero = 1036380,
    v128_load64_zero = 1036381,
    f32x4_demote_f64x2_zero = 1036382,
    f64x2_promote_low_f32x4 = 1036383,
    i8x16_abs = 1036384,
    i8x16_neg = 1036385,
    i8x16_popcnt = 1036386,
    i8x16_all_true = 1036387,
    i8x16_bitmask = 1036388,
    i8x16_narrow_i16x8_s = 1036389,
    i8x16_narrow_i16x8_u = 1036390,
    f32x4_ceil = 1036391,
    f32x4_floor = 1036392,
    f32x4_trunc = 1036393,
    f32x4_nearest = 1036394,
    i8x16_shl = 1036395,
    i8x16_shr_s = 1036396,
    i8x16_shr_u = 1036397,
    i8x16_add = 1036398,
    i8x16_add_sat_s = 1036399,
    i8x16_add_sat_u = 1036400,
    i8x16_sub = 1036401,
    i8x16_sub_sat_s = 1036402,
    i8x16_sub_sat_u = 1036403,
    f64x2_ceil = 1036404,
    f64x2_floor = 1036405,
    i8x16_min_s = 1036406,
    i8x16_min_u = 1036407,
    i8x16_max_s = 1036408,
    i8x16_max_u = 1036409,
    f64x2_trunc = 1036410,
    i8x16_avgr_u = 1036411,
    i16x8_extadd_pairwise_i8x16_s = 1036412,
    i16x8_extadd_pairwise_i8x16_u = 1036413,
    i32x4_extadd_pairwise_i16x8_s = 1036414,
    i32x4_extadd_pairwise_i16x8_u = 1036415,
    i16x8_abs = 1036416,
    i16x8_neg = 1036417,
    i16x8_q15mulr_sat_s = 1036418,
    i16x8_all_true = 1036419,
    i16x8_bitmask = 1036420,
    i16x8_narrow_i32x4_s = 1036421,
    i16x8_narrow_i32x4_u = 1036422,
    i16x8_extend_low_i8x16_s = 1036423,
    i16x8_extend_high_i8x16_s = 1036424,
    i16x8_extend_low_i8x16_u = 1036425,
    i16x8_extend_high_i8x16_u = 1036426,
    i16x8_shl = 1036427,
    i16x8_shr_s = 1036428,
    i16x8_shr_u = 1036429,
    i16x8_add = 1036430,
    i16x8_add_sat_s = 1036431,
    i16x8_add_sat_u = 1036432,
    i16x8_sub = 1036433,
    i16x8_sub_sat_s = 1036434,
    i16x8_sub_sat_u = 1036435,
    f64x2_nearest = 1036436,
    i16x8_mul = 1036437,
    i16x8_min_s = 1036438,
    i16x8_min_u = 1036439,
    i16x8_max_s = 1036440,
    i16x8_max_u = 1036441,
    i16x8_avgr_u = 1036443,
    i16x8_extmul_low_i8x16_s = 1036444,
    i16x8_extmul_high_i8x16_s = 1036445,
    i16x8_extmul_low_i8x16_u = 1036446,
    i16x8_extmul_high_i8x16_u = 1036447,
    i32x4_abs = 1036448,
    i32x4_neg = 1036449,
    i32x4_all_true = 1036451,
    i32x4_bitmask = 1036452,
    i32x4_extend_low_i16x8_s = 1036455,
    i32x4_extend_high_i16x8_s = 1036456,
    i32x4_extend_low_i16x8_u = 1036457,
    i32x4_extend_high_i16x8_u = 1036458,
    i32x4_shl = 1036459,
    i32x4_shr_s = 1036460,
    i32x4_shr_u = 1036461,
    i32x4_add = 1036462,
    i32x4_sub = 1036465,
    i32x4_mul = 1036469,
    i32x4_min_s = 1036470,
    i32x4_min_u = 1036471,
    i32x4_max_s = 1036472,
    i32x4_max_u = 1036473,
    i32x4_dot_i16x8_s = 1036474,
    i32x4_extmul_low_i16x8_s = 1036476,
    i32x4_extmul_high_i16x8_s = 1036477,
    i32x4_extmul_low_i16x8_u = 1036478,
    i32x4_extmul_high_i16x8_u = 1036479,
    i64x2_abs = 1036480,
    i64x2_neg = 1036481,
    i64x2_all_true = 1036483,
    i64x2_bitmask = 1036484,
    i64x2_extend_low_i32x4_s = 1036487,
    i64x2_extend_high_i32x4_s = 1036488,
    i64x2_extend_low_i32x4_u = 1036489,
    i64x2_extend_high_i32x4_u = 1036490,
    i64x2_shl = 1036491,
    i64x2_shr_s = 1036492,
    i64x2_shr_u = 1036493,
    i64x2_add = 1036494,
    i64x2_sub = 1036497,
    i64x2_mul = 1036501,
    i64x2_eq = 1036502,
    i64x2_ne = 1036503,
    i64x2_lt_s = 1036504,
    i64x2_gt_s = 1036505,
    i64x2_le_s = 1036506,
    i64x2_ge_s = 1036507,
    i64x2_extmul_low_i32x4_s = 1036508,
    i64x2_extmul_high_i32x4_s = 1036509,
    i64x2_extmul_low_i32x4_u = 1036510,
    i64x2_extmul_high_i32x4_u = 1036511,
    f32x4_abs = 1036512,
    f32x4_neg = 1036513,
    f32x4_sqrt = 1036515,
    f32x4_add = 1036516,
    f32x4_sub = 1036517,
    f32x4_mul = 1036518,
    f32x4_div = 1036519,
    f32x4_min = 1036520,
    f32x4_max = 1036521,
    f32x4_pmin = 1036522,
    f32x4_pmax = 1036523,
    f64x2_abs = 1036524,
    f64x2_neg = 1036525,
    f64x2_sqrt = 1036527,
    f64x2_add = 1036528,
    f64x2_sub = 1036529,
    f64x2_mul = 1036530,
    f64x2_div = 1036531,
    f64x2_min = 1036532,
    f64x2_max = 1036533,
    f64x2_pmin = 1036534,
    f64x2_pmax = 1036535,
    i32x4_trunc_sat_f32x4_s = 1036536,
    i32x4_trunc_sat_f32x4_u = 1036537,
    f32x4_convert_i32x4_s = 1036538,
    f32x4_convert_i32x4_u = 1036539,
    i32x4_trunc_sat_f64x2_s_zero = 1036540,
    i32x4_trunc_sat_f64x2_u_zero = 1036541,
    f64x2_convert_low_i32x4_s = 1036542,
    f64x2_convert_low_i32x4_u = 1036543,
    i8x16_relaxed_swizzle = 1036544,
    i32x4_relaxed_trunc_f32x4_s = 1036545,
    i32x4_relaxed_trunc_f32x4_u = 1036546,
    i32x4_relaxed_trunc_f64x2_s_zero = 1036547,
    i32x4_relaxed_trunc_f64x2_u_zero = 1036548,
    f32x4_relaxed_madd = 1036549,
    f32x4_relaxed_nmadd = 1036550,
    f64x2_relaxed_madd = 1036551,
    f64x2_relaxed_nmadd = 1036552,
    i8x16_relaxed_laneselect = 1036553,
    i16x8_relaxed_laneselect = 1036554,
    i32x4_relaxed_laneselect = 1036555,
    i64x2_relaxed_laneselect = 1036556,
    f32x4_relaxed_min = 1036557,
    f32x4_relaxed_max = 1036558,
    f64x2_relaxed_min = 1036559,
    f64x2_relaxed_max = 1036560,
    i16x8_relaxed_q15mulr_s = 1036561,
    i16x8_relaxed_dot_i8x16_i7x16_s = 1036562,
    i32x4_relaxed_dot_i8x16_i7x16_add_s = 1036563,
    struct_new = 64256,
    struct_new_default = 64257,
    struct_get = 64258,
    struct_get_s = 64259,
    struct_get_u = 64260,
    struct_set = 64261,
    array_new = 64262,
    array_new_default = 64263,
    array_new_fixed = 64264,
    array_new_data = 64265,
    array_new_elem = 64266,
    array_get = 64267,
    array_get_s = 64268,
    array_get_u = 64269,
    array_set = 64270,
    array_len = 64271,
    array_fill = 64272,
    array_copy = 64273,
    array_init_data = 64274,
    array_init_elem = 64275,
    ref_test = 64276,
    ref_test_null = 64277,
    ref_cast = 64278,
    ref_cast_null = 64279,
    br_on_cast = 64280,
    br_on_cast_fail = 64281,
    any_convert_extern = 64282,
    extern_convert_any = 64283,
    ref_i31 = 64284,
    i31_get_s = 64285,
    i31_get_u = 64286
}
export declare const OperatorCodeNames: string[];
export declare const enum ExternalKind {
    Function = 0,
    Table = 1,
    Memory = 2,
    Global = 3,
    Tag = 4
}
export declare const enum TypeKind {
    unspecified = 0,
    i32 = -1,
    i64 = -2,
    f32 = -3,
    f64 = -4,
    v128 = -5,
    i8 = -8,
    i16 = -9,
    nullexnref = -12,
    nullfuncref = -13,
    nullref = -15,
    nullexternref = -14,
    funcref = -16,
    externref = -17,
    anyref = -18,
    eqref = -19,
    i31ref = -20,
    structref = -21,
    arrayref = -22,
    exnref = -23,
    ref = -28,
    ref_null = -29,
    func = -32,
    struct = -33,
    array = -34,
    subtype = -48,
    subtype_final = -49,
    rec_group = -50,
    empty_block_type = -64
}
export declare class FieldDef {
    ty: Type;
    mutable: boolean;
}
export declare class FuncDef {
    params: Type[];
    results: Type[];
}
export declare class Type {
    code: number;
    constructor(code: number);
    get isIndex(): boolean;
    get kind(): TypeKind;
    get index(): number;
    static funcref: Type;
    static externref: Type;
    static exnref: Type;
}
export declare class RefType extends Type {
    ref_index: number;
    constructor(kind: TypeKind, ref_index: number);
    get isNullable(): boolean;
}
export declare enum CatchHandlerKind {
    Catch = 0,
    CatchRef = 1,
    CatchAll = 2,
    CatchAllRef = 3
}
export declare class CatchHandler {
    kind: CatchHandlerKind;
    depth: number;
    tagIndex?: number;
}
export declare const enum RelocType {
    FunctionIndex_LEB = 0,
    TableIndex_SLEB = 1,
    TableIndex_I32 = 2,
    GlobalAddr_LEB = 3,
    GlobalAddr_SLEB = 4,
    GlobalAddr_I32 = 5,
    TypeIndex_LEB = 6,
    GlobalIndex_LEB = 7
}
export declare const enum LinkingType {
    StackPointer = 1
}
export declare const enum NameType {
    Module = 0,
    Function = 1,
    Local = 2,
    Label = 3,
    Type = 4,
    Table = 5,
    Memory = 6,
    Global = 7,
    Elem = 8,
    Data = 9,
    Field = 10,
    Tag = 11
}
export declare const enum BinaryReaderState {
    ERROR = -1,
    INITIAL = 0,
    BEGIN_WASM = 1,
    END_WASM = 2,
    BEGIN_SECTION = 3,
    END_SECTION = 4,
    SKIPPING_SECTION = 5,
    READING_SECTION_RAW_DATA = 6,
    SECTION_RAW_DATA = 7,
    TYPE_SECTION_ENTRY = 11,
    IMPORT_SECTION_ENTRY = 12,
    FUNCTION_SECTION_ENTRY = 13,
    TABLE_SECTION_ENTRY = 14,
    MEMORY_SECTION_ENTRY = 15,
    GLOBAL_SECTION_ENTRY = 16,
    EXPORT_SECTION_ENTRY = 17,
    DATA_SECTION_ENTRY = 18,
    NAME_SECTION_ENTRY = 19,
    ELEMENT_SECTION_ENTRY = 20,
    LINKING_SECTION_ENTRY = 21,
    START_SECTION_ENTRY = 22,
    TAG_SECTION_ENTRY = 23,
    BEGIN_INIT_EXPRESSION_BODY = 25,
    INIT_EXPRESSION_OPERATOR = 26,
    END_INIT_EXPRESSION_BODY = 27,
    BEGIN_FUNCTION_BODY = 28,
    READING_FUNCTION_HEADER = 29,
    CODE_OPERATOR = 30,
    END_FUNCTION_BODY = 31,
    SKIPPING_FUNCTION_BODY = 32,
    BEGIN_ELEMENT_SECTION_ENTRY = 33,
    ELEMENT_SECTION_ENTRY_BODY = 34,
    END_ELEMENT_SECTION_ENTRY = 35,
    BEGIN_DATA_SECTION_ENTRY = 36,
    DATA_SECTION_ENTRY_BODY = 37,
    END_DATA_SECTION_ENTRY = 38,
    BEGIN_GLOBAL_SECTION_ENTRY = 39,
    END_GLOBAL_SECTION_ENTRY = 40,
    RELOC_SECTION_HEADER = 41,
    RELOC_SECTION_ENTRY = 42,
    SOURCE_MAPPING_URL = 43,
    BEGIN_OFFSET_EXPRESSION_BODY = 44,
    OFFSET_EXPRESSION_OPERATOR = 45,
    END_OFFSET_EXPRESSION_BODY = 46,
    BEGIN_REC_GROUP = 47,
    END_REC_GROUP = 48,
    DATA_COUNT_SECTION_ENTRY = 49
}
export declare const enum DataMode {
    Active = 0,
    Passive = 1
}
export declare const enum ElementMode {
    Active = 0,
    Passive = 1,
    Declarative = 2
}
export interface IModuleHeader {
    magicNumber: number;
    version: number;
}
export interface IResizableLimits {
    initial: number;
    maximum?: number;
}
export interface ITableType {
    elementType: Type;
    limits: IResizableLimits;
}
export interface IMemoryType {
    limits: IResizableLimits;
    shared: boolean;
}
export interface IGlobalType {
    contentType: Type;
    mutability: number;
}
export declare enum TagAttribute {
    Exception = 0
}
export interface ITagType {
    attribute: TagAttribute;
    typeIndex: number;
}
export interface IGlobalVariable {
    type: IGlobalType;
}
export interface IElementSegment {
    mode: ElementMode;
    tableIndex?: number;
}
export interface IElementSegmentBody {
    elementType: Type;
}
export interface IDataSegment {
    mode: DataMode;
    memoryIndex?: number;
}
export interface IDataSegmentBody {
    data: Uint8Array;
}
export type ImportEntryType = ITableType | IMemoryType | IGlobalType | ITagType;
export interface IImportEntry {
    module: Uint8Array;
    field: Uint8Array;
    kind: ExternalKind;
    funcTypeIndex?: number;
    type?: ImportEntryType;
}
export interface IExportEntry {
    field: Uint8Array;
    kind: ExternalKind;
    index: number;
}
export interface INameEntry {
    type: NameType;
}
export interface INaming {
    index: number;
    name: Uint8Array;
}
export interface IModuleNameEntry extends INameEntry {
    moduleName: Uint8Array;
}
export interface IFunctionNameEntry extends INameEntry {
    names: INaming[];
}
export interface ILocalName {
    index: number;
    locals: INaming[];
}
export interface ILocalNameEntry extends INameEntry {
    funcs: ILocalName[];
}
export interface ITagNameEntry extends INameEntry {
    names: INaming[];
}
export interface ITypeNameEntry extends INameEntry {
    names: INaming[];
}
export interface ITableNameEntry extends INameEntry {
    names: INaming[];
}
export interface IMemoryNameEntry extends INameEntry {
    names: INaming[];
}
export interface IGlobalNameEntry extends INameEntry {
    names: INaming[];
}
export interface IFieldName {
    index: number;
    fields: INaming[];
}
export interface IFieldNameEntry extends INameEntry {
    types: IFieldName[];
}
export interface ILinkingEntry {
    type: LinkingType;
    index?: number;
}
export interface IRelocHeader {
    id: SectionCode;
    name: Uint8Array;
}
export interface IRelocEntry {
    type: RelocType;
    offset: number;
    index: number;
    addend?: number;
}
export interface ISourceMappingURL {
    url: Uint8Array;
}
export interface IStartEntry {
    index: number;
}
export interface IFunctionEntry {
    typeIndex: number;
}
export interface ITypeEntry {
    form: number;
    params?: Type[];
    returns?: Type[];
    fields?: Type[];
    mutabilities?: boolean[];
    elementType?: Type;
    mutability?: boolean;
    supertypes?: number[];
    final?: boolean;
}
export interface ISectionInformation {
    id: SectionCode;
    name: Uint8Array;
}
export interface ILocals {
    count: number;
    type: Type;
}
export interface IFunctionInformation {
    locals: Array<ILocals>;
}
export interface IMemoryAddress {
    flags: number;
    offset: number;
}
export interface IOperatorInformation {
    code: OperatorCode;
    blockType?: Type;
    selectType?: Type;
    refType?: number;
    srcType?: number;
    brDepth?: number;
    brTable?: Array<number>;
    tryTable?: Array<CatchHandler>;
    relativeDepth?: number;
    funcIndex?: number;
    typeIndex?: number;
    tableIndex?: number;
    localIndex?: number;
    fieldIndex?: number;
    globalIndex?: number;
    segmentIndex?: number;
    tagIndex?: number;
    destinationIndex?: number;
    memoryAddress?: IMemoryAddress;
    literal?: number | Int64 | Uint8Array;
    len?: number;
    lines: Uint8Array;
    lineIndex: number;
}
export declare class Int64 {
    private _data;
    constructor(data: Uint8Array);
    toInt32(): number;
    toDouble(): number;
    toString(): string;
    get data(): Uint8Array;
}
export type BinaryReaderResult = IImportEntry | IExportEntry | IFunctionEntry | ITypeEntry | IModuleHeader | IOperatorInformation | IMemoryType | ITableType | IGlobalVariable | INameEntry | IElementSegment | IElementSegmentBody | IDataSegment | IDataSegmentBody | ISectionInformation | IFunctionInformation | ISectionInformation | IFunctionInformation | IRelocHeader | IRelocEntry | ILinkingEntry | ISourceMappingURL | IModuleNameEntry | IStartEntry | Uint8Array | number;
export declare class BinaryReader {
    private _data;
    private _pos;
    private _length;
    private _eof;
    state: BinaryReaderState;
    result: BinaryReaderResult;
    error: Error;
    private _sectionEntriesLeft;
    private _sectionId;
    private _sectionRange;
    private _functionRange;
    private _segmentType;
    private _segmentEntriesLeft;
    private _recGroupTypesLeft;
    get data(): Uint8Array;
    get position(): number;
    get length(): number;
    setData(buffer: ArrayBuffer, pos: number, length: number, eof?: boolean): void;
    private hasBytes;
    hasMoreBytes(): boolean;
    private readUint8;
    private readInt32;
    private readUint32;
    private peekInt32;
    private hasVarIntBytes;
    private readVarUint1;
    private readVarInt7;
    private readVarUint7;
    private readVarInt32;
    private readVarUint32;
    private readVarInt64;
    private readHeapType;
    private readType;
    private readStringBytes;
    private readBytes;
    private skipBytes;
    private hasStringBytes;
    private hasSectionPayload;
    private readFuncType;
    private readBaseType;
    private readSubtype;
    private readStructType;
    private readArrayType;
    private readResizableLimits;
    private readTableType;
    private readMemoryType;
    private readGlobalType;
    private readTagType;
    private readTypeEntryCommon;
    private readTypeEntry;
    private readRecGroupEntry;
    private readImportEntry;
    private readExportEntry;
    private readFunctionEntry;
    private readTableEntry;
    private readMemoryEntry;
    private readTagEntry;
    private readGlobalEntry;
    private readElementEntry;
    private readElementEntryBody;
    private readDataEntry;
    private readDataCountEntry;
    private readDataEntryBody;
    private readInitExpressionBody;
    private readOffsetExpressionBody;
    private readMemoryImmediate;
    private readNameMap;
    private readNameEntry;
    private readRelocHeader;
    private readLinkingEntry;
    private readSourceMappingURL;
    private readRelocEntry;
    private readCodeOperator_0xfb;
    private readCodeOperator_0xfc;
    private readCodeOperator_0xfd;
    private readCodeOperator_0xfe;
    private readCodeOperator;
    private readFunctionBody;
    private readSectionHeader;
    private readSectionRawData;
    private readSectionBody;
    read(): boolean;
    skipSection(): void;
    skipFunctionBody(): void;
    skipInitExpression(): void;
    fetchSectionRawData(): void;
}
export declare var bytesToString: (bytes: Uint8Array) => string;
export interface IBinaryReaderData {
    state: BinaryReaderState;
    result?: BinaryReaderResult;
}
