use device_query::{DeviceQuery, DeviceState};
use std::{thread, time::{Duration, Instant}};
use tauri::Window;
use tauri::Emitter;

#[tauri::command]
pub fn start_idle_detection(window: Window) {
    thread::spawn(move || {
        let device_state = DeviceState::new();
        let mut last_activity = Instant::now();
        let mut last_mouse_pos = device_state.get_mouse().coords;

        loop {
            let mouse_pos = device_state.get_mouse().coords;
            let keys = device_state.get_keys();

            if mouse_pos != last_mouse_pos || !keys.is_empty() {
                last_activity = Instant::now();
                last_mouse_pos = mouse_pos;
            }

            if last_activity.elapsed().as_secs() > 120 {
                let _ = window.emit("user_idle", true);
            }

            thread::sleep(Duration::from_secs(1));
        }
    });
} 