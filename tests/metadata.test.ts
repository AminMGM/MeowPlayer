import { describe, expect, it } from 'vitest'
import { cleanTag, cleanTitle, isJunkTag, parseFileName } from '../electron/tagtext'
import { indexLetter } from '../src/components/AlphaIndex'
import { matchPlaylist, parsePlaylistExport } from '../src/spotify'
import type { Track } from '../src/types'

describe('cleanTitle', () => {
  it('drops upload junk', () => {
    expect(cleanTitle('Song Name (Official Video)')).toBe('Song Name')
    expect(cleanTitle('Song Name [Official Music Video]')).toBe('Song Name')
    expect(cleanTitle('Song_Name (Lyrics)')).toBe('Song Name')
    expect(cleanTitle('Song Name - www.example.com')).toBe('Song Name')
  })

  it('keeps real parts of a title', () => {
    expect(cleanTitle('Song Name (Live)')).toBe('Song Name (Live)')
    expect(cleanTitle('Song Name (feat. Someone)')).toBe('Song Name (feat. Someone)')
  })
})

describe('parseFileName', () => {
  it('reads track number, artist and title', () => {
    expect(parseFileName('C:\\Music\\03. Some Artist - Some Song (Official Audio).mp3')).toEqual({
      trackNo: 3,
      artist: 'Some Artist',
      title: 'Some Song',
    })
  })

  it('handles a bare title', () => {
    expect(parseFileName('/music/Just_A_Title.flac')).toEqual({ title: 'Just A Title', trackNo: undefined })
  })

  it('does not take a number that is the title', () => {
    expect(parseFileName('/music/1999.mp3').title).toBe('1999')
  })
})

describe('indexLetter', () => {
  it('groups by first letter', () => {
    expect(indexLetter('abba')).toBe('A')
    expect(indexLetter('Émilie')).toBe('E')
    expect(indexLetter('2 Become 1')).toBe('#')
    expect(indexLetter('(Intro)')).toBe('#')
    expect(indexLetter('سلام')).toBe('س')
  })
})

describe('spotify import', () => {
  const track = (id: string, title: string, artist: string, album = ''): Track =>
    ({ id, title, artist, albumArtist: artist, album }) as Track

  it('reads an Exportify CSV', () => {
    const csv = '﻿"Track URI","Track Name","Artist Name(s)","Album Name"\n' +
      '"spotify:track:1","Hello, World","Artist A,Artist B","Album ""X"""\n' +
      '"spotify:track:2","Second","Artist C","Y"\n'
    expect(parsePlaylistExport(csv)).toEqual([
      { title: 'Hello, World', artist: 'Artist A', album: 'Album "X"' },
      { title: 'Second', artist: 'Artist C', album: 'Y' },
    ])
  })

  it('reads plain "Artist - Title" lines', () => {
    expect(parsePlaylistExport('Artist A - Song One\nSong Two')).toEqual([
      { artist: 'Artist A', title: 'Song One', album: '' },
      { artist: '', title: 'Song Two', album: '' },
    ])
  })

  it('matches loosely and reports what is missing', () => {
    const library = [track('1', 'Song One', 'Artist A'), track('2', 'Song Two (Remastered)', 'Artist B'), track('3', 'Song One', 'Other')]
    const result = matchPlaylist(
      [
        { title: 'Song One', artist: 'Artist A', album: '' },
        { title: 'Song Two - 2011 Remaster', artist: 'Artist B', album: '' },
        { title: 'Not Here', artist: 'Nobody', album: '' },
      ],
      library,
    )
    expect(result.ids).toEqual(['1', '2'])
    expect(result.missing.map((row) => row.title)).toEqual(['Not Here'])
  })
})

describe('junk tags', () => {
  it('spots channel names and links', () => {
    expect(isJunkTag('@IRMusicMag')).toBe(true)
    expect(isJunkTag('Night Visions (t.me/somechannel)')).toBe(true)
    expect(isJunkTag('Imagine Dragons')).toBe(false)
    expect(isJunkTag('Night Visions (Deluxe)')).toBe(false)
  })

  it('cleans them out', () => {
    expect(cleanTag('@IRMusicMag')).toBe('')
    expect(cleanTag('Night Visions (t.me/somechannel)')).toBe('Night Visions')
    expect(cleanTag('Demons - @SomeChannel')).toBe('Demons')
    expect(cleanTitle('Demons [www.example.ir]')).toBe('Demons')
  })
})
