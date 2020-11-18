
class ExoPlayerPlugin {
    constructor({appSettings, events, playbackManager, loading}) {
        this.self = this;

        self.appSettings = appSettings;
        self.events = events;
        self.playbackManager = playbackManager;
        self.loading = loading;

        window.ExoPlayer = self;

        self.name = 'ExoPlayer';
        self.type = 'mediaplayer';
        self.id = 'exoplayer';
        self.subtitleStreamIndex = -1;
        self.audioStreamIndex = -1;
        self.cachedDeviceProfile = null;

        // Prioritize first
        self.priority = -1;
        self.supportsProgress = false;
        self.isLocalPlayer = true;

        // Current playback position in milliseconds
        self._currentTime = 0;
        self._paused = true;
        self._currentSrc = null;
    }

    canPlayMediaType(mediaType) {
        return mediaType === 'Video';
    }

    canPlayItem(item, playOptions) {
        return window.NativePlayer.isEnabled();
    }

    currentSrc() {
        return self._currentSrc;
    }

    play(options) {
        self.prepareAudioTracksCapabilities(options);

        return new Promise(function (resolve) {
            self._paused = false;
            self._currentSrc = options.url;
            window.NativePlayer.loadPlayer(JSON.stringify(options));
            self.loading.hide();
            resolve();
        });
    }

    duration(val) {
        return null;
    }

    destroy() {
        window.NativePlayer.destroyPlayer();
    }

    pause() {
        self._paused = true;
        window.NativePlayer.pausePlayer();
    }

    unpause() {
        self._paused = false;
        window.NativePlayer.resumePlayer();
    }

    paused() {
        return self._paused;
    }

    stop(destroyPlayer) {
        return new Promise(function (resolve) {
            window.NativePlayer.stopPlayer();

            if (destroyPlayer) {
                self.destroy();
            }

            resolve();
        });
    }

    /**
     * Get or set volume percentage as as string
     */
    volume(volume) {
        if (volume !== undefined) {
            let volumeInt = parseInt(volume);
            window.NativePlayer.setVolume(volumeInt);
        }
        return null;
    }

    setMute(mute) {
        // Assume 30% as default when unmuting
        window.NativePlayer.setVolume(mute ? 0 : 30);
    }

    isMuted() {
        return false;
    }

    seekable() {
        return true;
    }

    seek(ticks) {
        window.NativePlayer.seek(ticks);
    }

    currentTime(ms) {
        if (ms !== undefined) {
            window.NativePlayer.seekMs(ms);
        }
        return self._currentTime;
    }

    setSubtitleStreamIndex(index) {
        self.subtitleStreamIndex = index;
    }

    canSetAudioStreamIndex() {
        return false;
    }

    setAudioStreamIndex(index) {
        self.audioStreamIndex = index;
    }

    changeSubtitleStream(index) {
        // detach from the main ui thread
        new Promise(function () {
            var innerIndex = Number(index);
            self.playbackManager.setSubtitleStreamIndex(innerIndex);
            self.subtitleStreamIndex = innerIndex;
        });
    }

    changeAudioStream(index) {
        // detach from the main ui thread
        new Promise(function () {
            var innerIndex = Number(index);
            self.playbackManager.setAudioStreamIndex(innerIndex);
            self.audioStreamIndex = innerIndex;
        });
    }

    prepareAudioTracksCapabilities(options) {
        var directPlayProfiles = self.cachedDeviceProfile.DirectPlayProfiles;
        var container = options.mediaSource.Container;

        options.mediaSource.MediaStreams.forEach(function (track) {
            if (track.Type === "Audio") {
                var codec = (track.Codec || '').toLowerCase();

                track.supportsDirectPlay = directPlayProfiles.filter(function (profile) {
                    return profile.Container === container && profile.Type === 'Video' && profile.AudioCodec.indexOf(codec) !== -1;
                }).length > 0;
            }
        });
    }

    notifyStopped() {
        new Promise(function () {
            let stopInfo = {
                src: self._currentSrc
            };

            self.events.trigger(self, 'stopped', [stopInfo]);
            self._currentSrc = self._currentTime = null;
        });
    }

    getDeviceProfile() {
        // using native player implementations, check if item can be played
        // also check if direct play is supported, as audio is supported
        return new Promise(function (resolve) {
            if (self.cachedDeviceProfile) {
                resolve(self.cachedDeviceProfile);
            }

            var bitrateSetting = self.appSettings.maxStreamingBitrate();

            var profile = {};
            profile.Name = "Android ExoPlayer"
            profile.MaxStreamingBitrate = bitrateSetting;
            profile.MaxStaticBitrate = 100000000;
            profile.MusicStreamingTranscodingBitrate = 192000;

            profile.SubtitleProfiles = [];
            profile.DirectPlayProfiles = [];
            profile.CodecProfiles = [];

            var videoProfiles = {
                '3gp': ['h263', 'h264', 'mpeg4', 'hevc'],
                'mp4': ['h263', 'h264', 'mpeg4', 'hevc', 'mpeg2video', 'av1', 'mpeg1video'],
                'ts': ['h264', 'mpeg4'],
                'webm': ['vp8', 'vp9'],
                'mkv': ['h264', 'mpeg4', 'hevc', 'vp8', 'vp9', 'mpeg2video', 'mpeg1video'],
                'flv': ['h264', 'mpeg4'],
                'asf': ['mpeg2video', 'mpeg4', 'h263', 'h264', 'hevc', 'vp8', 'vp9', 'mpeg1video'],
                'm2ts': ['mp2g2video', 'mpeg4', 'h264', 'mpeg1video'],
                'vob': ['mpeg1video', 'mpeg2video'],
                'mov': ['mpeg1video', 'mpeg2video', 'mpeg4', 'h263', 'h264', 'hevc']
            };

            var audioProfiles = {
                '3gp': ['aac', '3gpp', 'flac'],
                'mp4': ['mp3', 'aac', 'mp1', 'mp2'],
                'ts': ['mp3', 'aac', 'mp1', 'mp2', 'ac3', 'dts'],
                'flac': ['flac'],
                'aac': ['aac'],
                'mkv': ['mp3', 'aac', 'dts', 'flac', 'vorbis', 'opus', 'ac3', 'wma', 'mp1', 'mp2'],
                'mp3': ['mp3'],
                'ogg': ['ogg', 'opus', 'vorbis'],
                'webm': ['vorbis', 'opus'],
                'flv': ['mp3', 'aac'],
                'asf': ['aac', 'ac3', 'dts', 'wma', 'flac', 'pcm'],
                'm2ts': ['aac', 'ac3', 'dts', 'pcm'],
                'vob': ['mp1'],
                'mov': ['mp3', 'aac', 'ac3', 'dts-hd', 'pcm']
            };

            var subtitleProfiles = ['ass', 'idx', 'pgs', 'pgssub', 'smi', 'srt', 'ssa', 'subrip'];

            subtitleProfiles.forEach(function (format) {
                profile.SubtitleProfiles.push({
                    Format: format,
                    Method: 'Embed'
                });
            });

            var externalSubtitleProfiles = ['srt', 'sub', 'subrip', 'vtt'];

            externalSubtitleProfiles.forEach(function (format) {
                profile.SubtitleProfiles.push({
                    Format: format,
                    Method: 'External'
                });
            });

            profile.SubtitleProfiles.push({
                Format: 'dvdsub',
                Method: 'Encode'
            });

            var codecs = JSON.parse(window.NativePlayer.getSupportedFormats());
            var videoCodecs = [];
            var audioCodecs = [];

            for (var index in codecs.audioCodecs) {
                if (codecs.audioCodecs.hasOwnProperty(index)) {
                    var audioCodec = codecs.audioCodecs[index];
                    audioCodecs.push(audioCodec.codec);

                    var profiles = audioCodec.profiles.join('|');
                    var maxChannels = audioCodec.maxChannels;
                    var maxSampleRate = audioCodec.maxSampleRate;

                    var conditions = [{
                        Condition: 'LessThanEqual',
                        Property: 'AudioBitrate',
                        Value: audioCodec.maxBitrate
                    }];

                    if (profiles) {
                        conditions.push({
                            Condition: 'EqualsAny',
                            Property: 'AudioProfile',
                            Value: profiles
                        });
                    }

                    if (maxChannels) {
                        conditions.push({
                            Condition: 'LessThanEqual',
                            Property: 'AudioChannels',
                            Value: maxChannels
                        });
                    }

                    if (maxSampleRate) {
                        conditions.push({
                            Condition: 'LessThanEqual',
                            Property: 'AudioSampleRate',
                            Value: maxSampleRate
                        });
                    }

                    profile.CodecProfiles.push({
                        Type: 'Audio',
                        Codec: audioCodec.codec,
                        Conditions: conditions
                    });
                }
            }

            for (var index in codecs.videoCodecs) {
                if (codecs.videoCodecs.hasOwnProperty(index)) {
                    var videoCodec = codecs.videoCodecs[index];
                    videoCodecs.push(videoCodec.codec);

                    var profiles = videoCodec.profiles.join('|');
                    var maxLevel = videoCodec.levels.length && Math.max.apply(null, videoCodec.levels);
                    var conditions = [{
                        Condition: 'LessThanEqual',
                        Property: 'VideoBitrate',
                        Value: videoCodec.maxBitrate
                    }];

                    if (profiles) {
                        conditions.push({
                            Condition: 'EqualsAny',
                            Property: 'VideoProfile',
                            Value: profiles
                        });
                    }

                    if (maxLevel) {
                        conditions.push({
                            Condition: 'LessThanEqual',
                            Property: 'VideoLevel',
                            Value: maxLevel
                        });
                    }

                    if (conditions.length) {
                        profile.CodecProfiles.push({
                            Type: 'Video',
                            Codec: videoCodec.codec,
                            Conditions: conditions
                        });
                    }
                }
            }

            for (var container in videoProfiles) {
                if (videoProfiles.hasOwnProperty(container)) {
                    profile.DirectPlayProfiles.push({
                        Container: container,
                        Type: 'Video',
                        VideoCodec: videoProfiles[container].filter(function (codec) {
                            return videoCodecs.indexOf(codec) !== -1;
                        }).join(','),
                        AudioCodec: audioProfiles[container].filter(function (codec) {
                            return audioCodecs.indexOf(codec) !== -1;
                        }).join(',')
                    });
                }
            }

            for (var container in audioProfiles) {
                if (audioProfiles.hasOwnProperty(container)) {
                    profile.DirectPlayProfiles.push({
                        Container: container,
                        Type: 'Audio',
                        AudioCodec: audioProfiles[container].filter(function (codec) {
                            return audioCodecs.indexOf(codec) !== -1;
                        }).join(',')
                    });
                }
            }

            profile.TranscodingProfiles = [
                {
                    Container: 'ts',
                    Type: 'Video',
                    AudioCodec: audioProfiles['ts'].filter(function (codec) {
                        return audioCodecs.indexOf(codec) !== -1;
                    }).join(','),
                    VideoCodec: 'h264',
                    Context: 'Streaming',
                    Protocol: 'hls',
                    MinSegments: 1
                },
                {
                    Container: 'mkv',
                    Type: 'Video',
                    AudioCodec: audioProfiles['mkv'].filter(function (codec) {
                        return audioCodecs.indexOf(codec) !== -1;
                    }).join(','),
                    VideoCodec: 'h264',
                    Context: 'Streaming'
                },
                {
                    Container: 'mp3',
                    Type: 'Audio',
                    AudioCodec: 'mp3',
                    Context: 'Streaming',
                    Protocol: 'http'
                },

            ];

            self.cachedDeviceProfile = profile;

            resolve(profile);
        });
    }
}

window.ExoPlayerPlugin = ExoPlayerPlugin;
