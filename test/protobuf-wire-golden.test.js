// Wire bytes captured with the previously released protobufjs 7.6.6 runtime.
// Protect generated WAProto code when evaluating runtime major upgrades.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proto } from '../WAProto/index.js';

const fixtures = [
  ['text', { conversation: 'Hello WhatsBibz 👋' }, '0a1448656c6c6f2057686174734269627a20f09f918b'],
  ['media-long', { imageMessage: { url: 'https://example.invalid/a', mimetype: 'image/jpeg', fileLength: '4294967301', width: 512, height: 256, mediaKey: Buffer.alloc(32, 7), fileSha256: Buffer.alloc(32, 3) } }, '1a770a1968747470733a2f2f6578616d706c652e696e76616c69642f61120a696d6167652f6a7065672220030303030303030303030303030303030303030303030303030303030303030328858080801030800238800442200707070707070707070707070707070707070707070707070707070707070707'],
  ['buttons', { buttonsMessage: { contentText: 'choose', footerText: 'test', buttons: [{ buttonId: 'a', buttonText: { displayText: 'One' }, type: 1 }] } }, 'd2021c320663686f6f73653a04746573744a0c0a016112050a034f6e651801'],
  ['audio-sticker', { audioStickerMessage: { message: { stickerMessage: { mimetype: 'image/webp', width: 512, height: 512, isAnimated: true, fileSha256: Buffer.alloc(32, 5), audioMessage: { mimetype: 'audio/ogg; codecs=opus', mediaKey: Buffer.alloc(32, 7), seconds: 5, directPath: '/audio' } } } } }, 'b20883010a8001d2017d122005050505050505050505050505050505050505050505050505050505050505052a0a696d6167652f776562703080043880046801d201441216617564696f2f6f67673b20636f646563733d6f70757328053a2007070707070707070707070707070707070707070707070707070707070707074a062f617564696f'],
];

for (const [name, object, hex] of fixtures) {
  test(`WAProto wire golden: ${name}`, () => {
    const msg = proto.Message.fromObject(object);
    assert.equal(proto.Message.verify(msg), null);
    const bytes = proto.Message.encode(msg).finish();
    assert.equal(Buffer.from(bytes).toString('hex'), hex);
    const decoded = proto.Message.decode(Buffer.from(hex, 'hex'));
    assert.equal(Buffer.from(proto.Message.encode(decoded).finish()).toString('hex'), hex);
    if (name === 'media-long') assert.equal(proto.Message.toObject(decoded, { longs: String }).imageMessage.fileLength, '4294967301');
  });
}
