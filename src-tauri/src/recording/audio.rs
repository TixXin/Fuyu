use std::sync::mpsc::{self, Receiver};

use crate::win32::{
    audio_capture::{AudioCapture, AudioSource},
    video_writer::VideoWriter,
};

use super::{
    mixer::{frames_at, ticks_at, Mixer},
    pacing::Pacer,
};

type Packet = (usize, Vec<f32>, i64);

pub(crate) struct Audio {
    sources: Vec<AudioCapture>,
    packets: Receiver<Packet>,
    mixer: Mixer,
    pub(crate) system: bool,
    pub(crate) microphone: bool,
}

impl Audio {
    pub(crate) fn start(system: bool, microphone: bool) -> Self {
        let (sender, packets) = mpsc::channel::<Packet>();
        let mut sources = Vec::new();
        let mut on = [false, false];
        for (index, (wanted, source)) in [(system, AudioSource::System), (microphone, AudioSource::Microphone)].into_iter().enumerate() {
            if !wanted {
                continue;
            }
            let sender = sender.clone();
            let track = sources.len();
            if let Ok(capture) = AudioCapture::start(source, move |samples, qpc| {
                let _ = sender.send((track, samples, qpc));
            }) {
                sources.push(capture);
                on[index] = true;
            }
        }
        Self { mixer: Mixer::new(sources.len()), sources, packets, system: on[0], microphone: on[1] }
    }

    pub(crate) fn is_on(&self) -> bool {
        !self.sources.is_empty()
    }

    fn collect<T: Clone>(&mut self, pacer: &Pacer<T>) {
        while let Ok((track, samples, qpc)) = self.packets.try_recv() {
            if let Some(at) = pacer.timeline(qpc) {
                self.mixer.push(track, frames_at(at), &samples);
            }
        }
    }

    fn write(&mut self, until: i64, writer: &VideoWriter) -> windows::core::Result<()> {
        let start = self.mixer.written();
        let samples = self.mixer.take(until);
        if samples.is_empty() {
            return Ok(());
        }
        let time = ticks_at(start);
        writer.write_audio(&samples, time, ticks_at(until) - time)
    }

    pub(crate) fn pump<T: Clone>(&mut self, pacer: &Pacer<T>, writer: &VideoWriter, now: i64) -> windows::core::Result<()> {
        if !self.is_on() {
            return Ok(());
        }
        self.collect(pacer);
        match pacer.timeline(now).and_then(|clock| self.mixer.ready(frames_at(clock))) {
            Some(until) => self.write(until, writer),
            None => Ok(()),
        }
    }

    pub(crate) fn finish<T: Clone>(&mut self, pacer: &Pacer<T>, writer: &VideoWriter) -> windows::core::Result<()> {
        if !self.is_on() {
            return Ok(());
        }
        self.sources.clear();
        self.collect(pacer);
        self.write(frames_at(pacer.duration()), writer)
    }
}
