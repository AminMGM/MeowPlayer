import { useStore } from '../store/useStore'
import { FavoritesView, PlaylistDetail, PlaylistsView, SearchView, SmartView, StatsView } from './Collection'
import { HomeView } from './Home'
import {
  AlbumDetail,
  AlbumsView,
  ArtistDetail,
  ArtistsView,
  FolderDetail,
  FoldersView,
  GenreDetail,
  GenresView,
  SongsView,
} from './Library'
import { NowPlayingView } from './NowPlaying'

/** Picks the page for the current view. Keyed so each page starts scrolled to the top. */
export function ViewRouter() {
  const view = useStore((state) => state.view)
  const key = `${view.kind}:${'id' in view ? view.id : ''}`

  const page = (() => {
    switch (view.kind) {
      case 'songs':
        return <SongsView />
      case 'albums':
        return <AlbumsView />
      case 'album':
        return <AlbumDetail id={view.id} />
      case 'artists':
        return <ArtistsView />
      case 'artist':
        return <ArtistDetail id={view.id} />
      case 'playlists':
        return <PlaylistsView />
      case 'playlist':
        return <PlaylistDetail id={view.id} />
      case 'smart':
        return <SmartView id={view.id} />
      case 'favorites':
        return <FavoritesView />
      case 'search':
        return <SearchView />
      case 'folders':
        return <FoldersView />
      case 'folder':
        return <FolderDetail id={view.id} />
      case 'genres':
        return <GenresView />
      case 'genre':
        return <GenreDetail id={view.id} />
      case 'stats':
        return <StatsView />
      case 'nowplaying':
        return <NowPlayingView />
      default:
        return <HomeView />
    }
  })()

  return (
    <div className="page" key={key}>
      {page}
    </div>
  )
}
