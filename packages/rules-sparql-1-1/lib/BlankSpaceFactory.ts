import type {
  BlankSpace,
  Comment,
  IgnoredRTT,
  IgnoredRTT1,
  IgnoredRTT2,
  IgnoredRTT3,
  IgnoredRTT4,
  IgnoredRTT5,
  IgnoredRTT6,
  IgnoredRTT7,
  IgnoredRTT8,
  IgnoredRTT9,
  Ignores,
  Ignores1,
  Ignores2,
  Ignores3,
  Ignores4,
  Ignores5,
  Ignores6,
  Ignores7,
  Ignores8,
  Ignores9,
  ImageRTT,
  ImageRTT2,
  ImageRTT3,
  ImageRTT4,
  ImageRTT5,
  ImageRTT6,
  ImageRTT7,
  ImageRTT8,
  ImageRTT9,
  Images,
  Images2,
  Images3,
  Images4,
  Images5,
  Images6,
  Images7,
  Images8,
  Images9,
  Indexes0,
  ITO,
  ITOS,
  Wrap,
} from './TypeHelpersRTT';

export class BlankSpaceFactory {
  private isIgnores<Indexes extends Indexes0>(x: object, indexes: Indexes[]): x is Ignores<Indexes0> {
    return indexes.every(i => `i${i}` in x);
  }

  public isBS(x: ITO): x is BlankSpace {
    return 'bs' in x;
  }

  public blankSpace(blank: string): BlankSpace {
    return { bs: blank };
  }

  public comment(comment: string): Comment {
    return { comment };
  }

  public wrap<T>(val: T): Wrap<T> {
    return { val };
  }

  public ignores<T extends object>(value: T, ignored0: ITOS): T & Ignores;
  public ignores<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS): T & Ignores1;
  public ignores<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS): T & Ignores2;
  public ignores<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS): T & Ignores3;
  public ignores<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS): T & Ignores4;
  public ignores<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS, ignored5: ITOS): T & Ignores5;
  public ignores<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS, ignored6: ITOS): T & Ignores6;
  public ignores<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS, ignored6: ITOS, ignored7: ITOS): T & Ignores7;
  public ignores<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS, ignored6: ITOS, ignored7: ITOS, ignored8: ITOS): T & Ignores8;
  public ignores<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS, ignored6: ITOS, ignored7: ITOS, ignored8: ITOS, ignored9: ITOS): T & Ignores9;
  public ignores<T extends object>(value: T, ...ignored: ITOS[]): Record<any, any> {
    if (ignored.length > 10) {
      throw new Error('Too many ignored');
    }
    const result: Record<any, any> = value;
    for (const [ i, ignored_ ] of ignored.entries()) {
      result[`i${i}`] = ignored_;
    }
    return result;
  }

  public image<T extends object>(value: T, image1: string): T & Images;
  public image<T extends object>(value: T, image1: string, image2: string): T & Images2;
  public image<T extends object>(value: T, image1: string, image2: string, image3: string): T & Images3;
  public image<T extends object>(value: T, image1: string, image2: string, image3: string, image4: string): T & Images4;
  public image<T extends object>(value: T, image1: string, image2: string, image3: string, image4: string,
    image5: string): T & Images5;
  public image<T extends object>(value: T, image1: string, image2: string, image3: string, image4: string,
    image5: string, image6: string): T & Images6;
  public image<T extends object>(value: T, image1: string, image2: string, image3: string, image4: string,
    image5: string, image6: string, image7: string): T & Images7;
  public image<T extends object>(value: T, image1: string, image2: string, image3: string, image4: string,
    image5: string, image6: string, image7: string, image8: string): T & Images8;
  public image<T extends object>(value: T, image1: string, image2: string, image3: string, image4: string,
    image5: string, image6: string, image7: string, image8: string, image9: string): T & Images9;
  public image<T extends object>(value: T, ...images: string[]): Record<any, any> {
    if (images.length > 9) {
      throw new Error('Too many images');
    }
    const result: Record<string, any> = value;
    for (const [ i, image_ ] of images.entries()) {
      result[`img${i + 1}`] = image_;
    }
    return result;
  }

  public isIgnores0 = (x: object): x is Ignores => this.isIgnores(x, [ '0' ]);
  public isIgnores1 = (x: object): x is Ignores1 => this.isIgnores(x, [ '0', '1' ]);
  public isIgnores2 = (x: object): x is Ignores1 => this.isIgnores(x, [ '0', '1', '2' ]);

  private isImages<Indexes extends string>(x: object, indexes: Indexes[]): x is Images {
    return indexes.every(i => `img${i}` in x);
  }

  public isImages1 = (x: object): x is Images => this.isImages(x, [ '1' ]);
  public isImages2 = (x: object): x is Images2 => this.isImages(x, [ '1', '2' ]);

  public rttIgnore<T extends object>(value: T, ignored0: ITOS): IgnoredRTT<T>;
  public rttIgnore<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS): IgnoredRTT1<T>;
  public rttIgnore<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS): IgnoredRTT2<T>;
  public rttIgnore<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS): IgnoredRTT3<T>;
  public rttIgnore<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS): IgnoredRTT4<T>;
  public rttIgnore<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS, ignored5: ITOS): IgnoredRTT5<T>;
  public rttIgnore<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS, ignored5: ITOS, ignored6: ITOS): IgnoredRTT6<T>;
  public rttIgnore<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS, ignored5: ITOS, ignored6: ITOS, ignored7: ITOS): IgnoredRTT7<T>;
  public rttIgnore<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS, ignored5: ITOS, ignored6: ITOS, ignored7: ITOS, ignored8: ITOS): IgnoredRTT8<T>;
  public rttIgnore<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS,
    ignored3: ITOS, ignored4: ITOS, ignored5: ITOS, ignored6: ITOS, ignored7: ITOS, ignored8: ITOS,
    ignored9: ITOS): IgnoredRTT9<T>;
  public rttIgnore<T extends object>(value: T, ...ignored: ITOS[]): IgnoredRTT<T> {
    const val = <T & { RTT: any | undefined }> value;
    val.RTT = val.RTT ?? {};
    for (const [ i, ignore ] of ignored.entries()) {
      val.RTT[`i${i}`] = ignore;
    }
    return val;
  }

  public rttImage<T extends object>(value: T, image1: string): ImageRTT<T>;
  public rttImage<T extends object>(value: T, image1: string, image2: string): ImageRTT2<T>;
  public rttImage<T extends object>(value: T, image1: string, image2: string, image3: string): ImageRTT3<T>;
  public rttImage<T extends object>(value: T, image1: string, image2: string, image3: string,
    image4: string): ImageRTT4<T>;
  public rttImage<T extends object>(value: T, image1: string, image2: string, image3: string,
    image4: string, image5: string): ImageRTT5<T>;
  public rttImage<T extends object>(value: T, image1: string, image2: string, image3: string,
    image4: string, image5: string, image6: string): ImageRTT6<T>;
  public rttImage<T extends object>(value: T, image1: string, image2: string, image3: string,
    image4: string, image5: string, image6: string, image7: string): ImageRTT7<T>;
  public rttImage<T extends object>(value: T, image1: string, image2: string, image3: string,
    image4: string, image5: string, image6: string, image7: string, image8: string): ImageRTT8<T>;
  public rttImage<T extends object>(value: T, image1: string, image2: string, image3: string,
    image4: string, image5: string, image6: string, image7: string, image8: string, image9: string): ImageRTT9<T>;
  public rttImage<T extends object>(value: T, ...images: string[]): ImageRTT<T> {
    const val = <T & { RTT: any | undefined }> value;
    val.RTT = val.RTT ?? {};
    for (const [ i, image_ ] of images.entries()) {
      val.RTT[`img${i + 1}`] = image_;
    }
    return val;
  }
}
