/**
 * Blank Space Object.
 */
export type BlankSpace = { bs: string };
/**
 * Comment Object.
 * The comment can NEVER contain a newline - generators should ALWAYS append a newline
 */
export type Comment = { comment: string };
/**
 * Ignored Tracking Object
 */
export type ITO = BlankSpace | Comment;
/**
 * Ignored Track Object Sequence.
 */
export type ITOS = ITO[];
/**
 * Before Ignored Track Object Sequence
 */
export type Wrap<T> = { val: T };
export type Indexes0 = '0' | Indexes;
export type Indexes = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type Ignores<Idx extends Indexes0 = '0'> = {[k in `i${Idx}`]: ITOS };
export type Images<Idx extends Indexes = '1'> = {[k in `img${Idx}`]: string };
export type Reconstruct<IgnoredIdx extends Indexes0 = '0', ImageIdx extends Indexes = '1'> =
  Ignores<IgnoredIdx> & Images<ImageIdx>;

export type Ignored<Val, Idx extends Indexes0 = '0'> = Wrap<Val> & Ignores<Idx>;
export type Imaged<Val, Idx extends Indexes = '1'> = Wrap<Val> & Images<Idx>;
export type Reconstructed<Val, IgnoredIdx extends Indexes0 = '0', ImageIdx extends Indexes = '1'>
  = Wrap<Val> & Reconstruct<IgnoredIdx, ImageIdx>;

export type IgnoredRTT<Idx extends Indexes0 = '0'> = { RTT: Ignores<Idx> };
export type ImageRTT<Idx extends Indexes = '1'> = { RTT: Images<Idx> };
export type ReconstructRTT<IgnoredIdx extends Indexes0 = '0', ImageIdx extends Indexes = '1'>
  = IgnoredRTT<IgnoredIdx> & ImageRTT<ImageIdx>;

export type Images2 = Images<'1' | '2'>;
export type Images3 = Images<'1' | '2' | '3'>;
export type Images4 = Images<'1' | '2' | '3' | '4'>;
export type Images5 = Images<'1' | '2' | '3' | '4' | '5'>;
export type Images6 = Images<'1' | '2' | '3' | '4' | '5' | '6'>;
export type Images7 = Images<'1' | '2' | '3' | '4' | '5' | '6' | '7'>;
export type Images8 = Images<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'>;
export type Images9 = Images<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>;
export type Ignores1 = Ignores<'0' | '1'>;
export type Ignores2 = Ignores<'0' | '1' | '2'>;
export type Ignores3 = Ignores<'0' | '1' | '2' | '3'>;
export type Ignores4 = Ignores<'0' | '1' | '2' | '3' | '4'>;
export type Ignores5 = Ignores<'0' | '1' | '2' | '3' | '4' | '5'>;
export type Ignores6 = Ignores<'0' | '1' | '2' | '3' | '4' | '5' | '6'>;
export type Ignores7 = Ignores<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'>;
export type Ignores8 = Ignores<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'>;
export type Ignores9 = Ignores<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>;
export type Ignored1<T> = Ignored<T, '0' | '1'>;
export type Ignored2<T> = Ignored<T, '0' | '1' | '2'>;
export type Ignored3<T> = Ignored<T, '0' | '1' | '2' | '3'>;
export type Ignored4<T> = Ignored<T, '0' | '1' | '2' | '3' | '4'>;
export type Ignored5<T> = Ignored<T, '0' | '1' | '2' | '3' | '4' | '5'>;
export type Ignored6<T> = Ignored<T, '0' | '1' | '2' | '3' | '4' | '5' | '6'>;
export type Ignored7<T> = Ignored<T, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'>;
export type Ignored8<T> = Ignored<T, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'>;
export type Ignored9<T> = Ignored<T, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>;
export type Imaged2<T> = Imaged<T, '1' | '2'>;
export type Imaged3<T> = Imaged<T, '1' | '2' | '3'>;
export type Imaged4<T> = Imaged<T, '1' | '2' | '3' | '4'>;
export type Imaged5<T> = Imaged<T, '1' | '2' | '3' | '4' | '5'>;
export type Imaged6<T> = Imaged<T, '1' | '2' | '3' | '4' | '5' | '6'>;
export type Imaged7<T> = Imaged<T, '1' | '2' | '3' | '4' | '5' | '6' | '7'>;
export type Imaged8<T> = Imaged<T, '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'>;
export type Imaged9<T> = Imaged<T, '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>;
export type IgnoredRTT1 = IgnoredRTT<'0' | '1'>;
export type IgnoredRTT2 = IgnoredRTT<'0' | '1' | '2'>;
export type IgnoredRTT3 = IgnoredRTT<'0' | '1' | '2' | '3'>;
export type IgnoredRTT4 = IgnoredRTT<'0' | '1' | '2' | '3' | '4'>;
export type IgnoredRTT5 = IgnoredRTT<'0' | '1' | '2' | '3' | '4' | '5'>;
export type IgnoredRTT6 = IgnoredRTT<'0' | '1' | '2' | '3' | '4' | '5' | '6'>;
export type IgnoredRTT7 = IgnoredRTT<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'>;
export type IgnoredRTT8 = IgnoredRTT<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'>;
export type IgnoredRTT9 = IgnoredRTT<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>;
export type ImageRTT2 = ImageRTT<'1' | '2'>;
export type ImageRTT3 = ImageRTT<'1' | '2' | '3'>;
export type ImageRTT4 = ImageRTT<'1' | '2' | '3' | '4'>;
export type ImageRTT5 = ImageRTT<'1' | '2' | '3' | '4' | '5'>;
export type ImageRTT6 = ImageRTT<'1' | '2' | '3' | '4' | '5' | '6'>;
export type ImageRTT7 = ImageRTT<'1' | '2' | '3' | '4' | '5' | '6' | '7'>;
export type ImageRTT8 = ImageRTT<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'>;
export type ImageRTT9 = ImageRTT<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>;
