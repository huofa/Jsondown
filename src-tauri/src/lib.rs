mod commands;
mod models;
mod utils;

use commands::{
    config::{load_app_config, save_app_config},
    files::{
        create_file, create_unique_markdown_file, delete_empty_file_if_exists, read_file_preview,
        read_file_chunk, read_text_file, rename_path, write_text_file,
    },
    finder::reveal_in_finder,
    folders::{
        create_child_folder, create_root_folder, read_directory_tree, select_parent_folder,
        select_root_folder,
    },
    trash::{
        list_recently_deleted, move_to_recently_deleted, permanently_delete_trash_item,
        restore_deleted_file,
    },
    watcher::{watch_paths, WatcherState},
};

pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            select_root_folder,
            select_parent_folder,
            create_root_folder,
            read_directory_tree,
            read_file_preview,
            read_file_chunk,
            read_text_file,
            write_text_file,
            reveal_in_finder,
            load_app_config,
            save_app_config,
            create_child_folder,
            create_file,
            create_unique_markdown_file,
            delete_empty_file_if_exists,
            rename_path,
            move_to_recently_deleted,
            list_recently_deleted,
            restore_deleted_file,
            permanently_delete_trash_item,
            watch_paths,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Jsondown");
}
