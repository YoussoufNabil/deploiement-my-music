CREATE DATABASE IF NOT EXISTS my_music
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE my_music;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_key VARCHAR(512) NULL,
  bio TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS musiques (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  titre VARCHAR(180) NOT NULL,
  artiste VARCHAR(180) NOT NULL,
  genre VARCHAR(80) NULL,
  description TEXT NULL,
  audio_key VARCHAR(512) NOT NULL,
  cover_key VARCHAR(512) NULL,
  mime_type VARCHAR(120) NOT NULL DEFAULT 'audio/mpeg',
  duration_seconds INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_musiques_created (created_at),
  KEY idx_musiques_user (user_id),
  FULLTEXT KEY ft_musiques_search (titre, artiste, genre),
  CONSTRAINT fk_musiques_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS likes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  musique_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_likes_user_music (user_id, musique_id),
  KEY idx_likes_music (musique_id),
  CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_likes_music FOREIGN KEY (musique_id) REFERENCES musiques(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Compteur agrégé, une ligne par morceau.
CREATE TABLE IF NOT EXISTS nb_telechargements (
  musique_id BIGINT UNSIGNED NOT NULL,
  total BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMP NULL,
  PRIMARY KEY (musique_id),
  CONSTRAINT fk_downloads_music FOREIGN KEY (musique_id) REFERENCES musiques(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS news (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  titre VARCHAR(200) NOT NULL,
  contenu TEXT NOT NULL,
  image_key VARCHAR(512) NULL,
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_news_published (published_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS partages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  musique_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  share_token CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_partages_token (share_token),
  KEY idx_partages_music (musique_id),
  CONSTRAINT fk_shares_music FOREIGN KEY (musique_id) REFERENCES musiques(id) ON DELETE CASCADE,
  CONSTRAINT fk_shares_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
