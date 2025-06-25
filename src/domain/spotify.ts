/* eslint @typescript-eslint/no-unused-vars: 0 */
import type * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientError from "@effect/platform/HttpClientError"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import type { ParseError } from "effect/ParseResult"
import * as S from "effect/Schema"

export class GetAnAlbumParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

export class ExternalUrlObject extends S.Class<ExternalUrlObject>("ExternalUrlObject")({
  /**
   * The [Spotify URL](/documentation/web-api/concepts/spotify-uris-ids) for the object.
   */
  "spotify": S.optionalWith(S.String, { nullable: true })
}) {}

/**
 * The object type.
 */
export class SimplifiedArtistObjectType extends S.Literal("artist") {}

export class SimplifiedArtistObject extends S.Class<SimplifiedArtistObject>("SimplifiedArtistObject")({
  /**
   * Known external URLs for this artist.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * A link to the Web API endpoint providing full details of the artist.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the artist.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * The name of the artist.
   */
  "name": S.optionalWith(S.String, { nullable: true }),
  /**
   * The object type.
   */
  "type": S.optionalWith(SimplifiedArtistObjectType, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the artist.
   */
  "uri": S.optionalWith(S.String, { nullable: true })
}) {}

export class LinkedTrackObject extends S.Class<LinkedTrackObject>("LinkedTrackObject")({
  /**
   * Known external URLs for this track.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * A link to the Web API endpoint providing full details of the track.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the track.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * The object type: "track".
   */
  "type": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the track.
   */
  "uri": S.optionalWith(S.String, { nullable: true })
}) {}

export class TrackRestrictionObject extends S.Class<TrackRestrictionObject>("TrackRestrictionObject")({
  /**
   * The reason for the restriction. Supported values:
   * - `market` - The content item is not available in the given market.
   * - `product` - The content item is not available for the user's subscription type.
   * - `explicit` - The content item is explicit and the user's account is set to not play explicit content.
   *
   * Additional reasons may be added in the future.
   * **Note**: If you use this field, make sure that your application safely handles unknown values.
   */
  "reason": S.optionalWith(S.String, { nullable: true })
}) {}

export class SimplifiedTrackObject extends S.Class<SimplifiedTrackObject>("SimplifiedTrackObject")({
  /**
   * The artists who performed the track. Each artist object includes a link in `href` to more detailed information about the artist.
   */
  "artists": S.optionalWith(S.Array(SimplifiedArtistObject), { nullable: true }),
  /**
   * A list of the countries in which the track can be played, identified by their [ISO 3166-1 alpha-2](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) code.
   */
  "available_markets": S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * The disc number (usually `1` unless the album consists of more than one disc).
   */
  "disc_number": S.optionalWith(S.Int, { nullable: true }),
  /**
   * The track length in milliseconds.
   */
  "duration_ms": S.optionalWith(S.Int, { nullable: true }),
  /**
   * Whether or not the track has explicit lyrics ( `true` = yes it does; `false` = no it does not OR unknown).
   */
  "explicit": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * External URLs for this track.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * A link to the Web API endpoint providing full details of the track.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the track.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * Part of the response when [Track Relinking](/documentation/web-api/concepts/track-relinking/) is applied. If `true`, the track is playable in the given market. Otherwise `false`.
   */
  "is_playable": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Part of the response when [Track Relinking](/documentation/web-api/concepts/track-relinking/) is applied and is only part of the response if the track linking, in fact, exists. The requested track has been replaced with a different track. The track in the `linked_from` object contains information about the originally requested track.
   */
  "linked_from": S.optionalWith(LinkedTrackObject, { nullable: true }),
  /**
   * Included in the response when a content restriction is applied.
   */
  "restrictions": S.optionalWith(TrackRestrictionObject, { nullable: true }),
  /**
   * The name of the track.
   */
  "name": S.optionalWith(S.String, { nullable: true }),
  /**
   * A URL to a 30 second preview (MP3 format) of the track.
   */
  "preview_url": S.optionalWith(S.String, { nullable: true }),
  /**
   * The number of the track. If an album has several discs, the track number is the number on the specified disc.
   */
  "track_number": S.optionalWith(S.Int, { nullable: true }),
  /**
   * The object type: "track".
   */
  "type": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the track.
   */
  "uri": S.optionalWith(S.String, { nullable: true }),
  /**
   * Whether or not the track is from a local file.
   */
  "is_local": S.optionalWith(S.Boolean, { nullable: true })
}) {}

export class PagingSimplifiedTrackObject extends S.Class<PagingSimplifiedTrackObject>("PagingSimplifiedTrackObject")({
  "items": S.Array(SimplifiedTrackObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class CopyrightObject extends S.Class<CopyrightObject>("CopyrightObject")({
  /**
   * The copyright text for this content.
   */
  "text": S.optionalWith(S.String, { nullable: true }),
  /**
   * The type of copyright: `C` = the copyright, `P` = the sound recording (performance) copyright.
   */
  "type": S.optionalWith(S.String, { nullable: true })
}) {}

export class ExternalIdObject extends S.Class<ExternalIdObject>("ExternalIdObject")({
  /**
   * [International Standard Recording Code](http://en.wikipedia.org/wiki/International_Standard_Recording_Code)
   */
  "isrc": S.optionalWith(S.String, { nullable: true }),
  /**
   * [International Article Number](http://en.wikipedia.org/wiki/International_Article_Number_%28EAN%29)
   */
  "ean": S.optionalWith(S.String, { nullable: true }),
  /**
   * [Universal Product Code](http://en.wikipedia.org/wiki/Universal_Product_Code)
   */
  "upc": S.optionalWith(S.String, { nullable: true })
}) {}

/**
 * The type of the album.
 */
export class AlbumObjectAlbumType extends S.Literal("album", "single", "compilation") {}

export class ImageObject extends S.Class<ImageObject>("ImageObject")({
  /**
   * The source URL of the image.
   */
  "url": S.String,
  /**
   * The image height in pixels.
   */
  "height": S.NullOr(S.Int),
  /**
   * The image width in pixels.
   */
  "width": S.NullOr(S.Int)
}) {}

/**
 * The precision with which `release_date` value is known.
 */
export class AlbumObjectReleaseDatePrecision extends S.Literal("year", "month", "day") {}

/**
 * The reason for the restriction. Albums may be restricted if the content is not available in a given market, to the user's subscription type, or when the user's account is set to not play explicit content.
 * Additional reasons may be added in the future.
 */
export class AlbumRestrictionObjectReason extends S.Literal("market", "product", "explicit") {}

export class AlbumRestrictionObject extends S.Class<AlbumRestrictionObject>("AlbumRestrictionObject")({
  /**
   * The reason for the restriction. Albums may be restricted if the content is not available in a given market, to the user's subscription type, or when the user's account is set to not play explicit content.
   * Additional reasons may be added in the future.
   */
  "reason": S.optionalWith(AlbumRestrictionObjectReason, { nullable: true })
}) {}

/**
 * The object type.
 */
export class AlbumObjectType extends S.Literal("album") {}

export class AlbumObject extends S.Class<AlbumObject>("AlbumObject")({
  /**
   * The artists of the album. Each artist object includes a link in `href` to more detailed information about the artist.
   */
  "artists": S.optionalWith(S.Array(SimplifiedArtistObject), { nullable: true }),
  /**
   * The tracks of the album.
   */
  "tracks": S.optionalWith(PagingSimplifiedTrackObject, { nullable: true }),
  /**
   * The copyright statements of the album.
   */
  "copyrights": S.optionalWith(S.Array(CopyrightObject), { nullable: true }),
  /**
   * Known external IDs for the album.
   */
  "external_ids": S.optionalWith(ExternalIdObject, { nullable: true }),
  /**
   * **Deprecated** The array is always empty.
   */
  "genres": S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * The label associated with the album.
   */
  "label": S.optionalWith(S.String, { nullable: true }),
  /**
   * The popularity of the album. The value will be between 0 and 100, with 100 being the most popular.
   */
  "popularity": S.optionalWith(S.Int, { nullable: true }),
  /**
   * The type of the album.
   */
  "album_type": AlbumObjectAlbumType,
  /**
   * The number of tracks in the album.
   */
  "total_tracks": S.Int,
  /**
   * The markets in which the album is available: [ISO 3166-1 alpha-2 country codes](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). _**NOTE**: an album is considered available in a market when at least 1 of its tracks is available in that market._
   */
  "available_markets": S.Array(S.String),
  /**
   * Known external URLs for this album.
   */
  "external_urls": ExternalUrlObject,
  /**
   * A link to the Web API endpoint providing full details of the album.
   */
  "href": S.String,
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the album.
   */
  "id": S.String,
  /**
   * The cover art for the album in various sizes, widest first.
   */
  "images": S.Array(ImageObject),
  /**
   * The name of the album. In case of an album takedown, the value may be an empty string.
   */
  "name": S.String,
  /**
   * The date the album was first released.
   */
  "release_date": S.String,
  /**
   * The precision with which `release_date` value is known.
   */
  "release_date_precision": AlbumObjectReleaseDatePrecision,
  /**
   * Included in the response when a content restriction is applied.
   */
  "restrictions": S.optionalWith(AlbumRestrictionObject, { nullable: true }),
  /**
   * The object type.
   */
  "type": AlbumObjectType,
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the album.
   */
  "uri": S.String
}) {}

export class ErrorObject extends S.Class<ErrorObject>("ErrorObject")({
  /**
   * The HTTP status code (also returned in the response header; see [Response Status Codes](/documentation/web-api/concepts/api-calls#response-status-codes) for more information).
   */
  "status": S.Int.pipe(S.greaterThanOrEqualTo(400), S.lessThanOrEqualTo(599)),
  /**
   * A short description of the cause of the error.
   */
  "message": S.String
}) {}

export class GetAnAlbum401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnAlbum403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnAlbum429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleAlbumsParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the albums. Maximum: 20 IDs.
   */
  "ids": S.String,
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetMultipleAlbums200 extends S.Struct({
  "albums": S.Array(AlbumObject)
}) {}

export class GetMultipleAlbums401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleAlbums403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleAlbums429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnAlbumsTracksParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class GetAnAlbumsTracks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnAlbumsTracks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnAlbumsTracks429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtistParams extends S.Struct({}) {}

export class FollowersObject extends S.Class<FollowersObject>("FollowersObject")({
  /**
   * This will always be set to null, as the Web API does not support it at the moment.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The total number of followers.
   */
  "total": S.optionalWith(S.Int, { nullable: true })
}) {}

/**
 * The object type.
 */
export class ArtistObjectType extends S.Literal("artist") {}

export class ArtistObject extends S.Class<ArtistObject>("ArtistObject")({
  /**
   * Known external URLs for this artist.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * Information about the followers of the artist.
   */
  "followers": S.optionalWith(FollowersObject, { nullable: true }),
  /**
   * A list of the genres the artist is associated with. If not yet classified, the array is empty.
   */
  "genres": S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * A link to the Web API endpoint providing full details of the artist.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the artist.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * Images of the artist in various sizes, widest first.
   */
  "images": S.optionalWith(S.Array(ImageObject), { nullable: true }),
  /**
   * The name of the artist.
   */
  "name": S.optionalWith(S.String, { nullable: true }),
  /**
   * The popularity of the artist. The value will be between 0 and 100, with 100 being the most popular. The artist's popularity is calculated from the popularity of all the artist's tracks.
   */
  "popularity": S.optionalWith(S.Int, { nullable: true }),
  /**
   * The object type.
   */
  "type": S.optionalWith(ArtistObjectType, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the artist.
   */
  "uri": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetAnArtist401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtist403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtist429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleArtistsParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the artists. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class GetMultipleArtists200 extends S.Struct({
  "artists": S.Array(ArtistObject)
}) {}

export class GetMultipleArtists401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleArtists403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleArtists429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtistsAlbumsParams extends S.Struct({
  /**
   * A comma-separated list of keywords that will be used to filter the response. If not supplied, all album types will be returned. <br/>
   * Valid values are:<br/>- `album`<br/>- `single`<br/>- `appears_on`<br/>- `compilation`<br/>For example: `include_groups=album,single`.
   */
  "include_groups": S.optionalWith(S.String, { nullable: true }),
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

/**
 * This field describes the relationship between the artist and the album.
 */
export class ArtistDiscographyAlbumObjectAlbumGroup extends S.Literal("album", "single", "compilation", "appears_on") {}

/**
 * The type of the album.
 */
export class ArtistDiscographyAlbumObjectAlbumType extends S.Literal("album", "single", "compilation") {}

/**
 * The precision with which `release_date` value is known.
 */
export class ArtistDiscographyAlbumObjectReleaseDatePrecision extends S.Literal("year", "month", "day") {}

/**
 * The object type.
 */
export class ArtistDiscographyAlbumObjectType extends S.Literal("album") {}

export class ArtistDiscographyAlbumObject
  extends S.Class<ArtistDiscographyAlbumObject>("ArtistDiscographyAlbumObject")({
    /**
     * This field describes the relationship between the artist and the album.
     */
    "album_group": ArtistDiscographyAlbumObjectAlbumGroup,
    /**
     * The artists of the album. Each artist object includes a link in `href` to more detailed information about the artist.
     */
    "artists": S.Array(SimplifiedArtistObject),
    /**
     * The type of the album.
     */
    "album_type": ArtistDiscographyAlbumObjectAlbumType,
    /**
     * The number of tracks in the album.
     */
    "total_tracks": S.Int,
    /**
     * The markets in which the album is available: [ISO 3166-1 alpha-2 country codes](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). _**NOTE**: an album is considered available in a market when at least 1 of its tracks is available in that market._
     */
    "available_markets": S.Array(S.String),
    /**
     * Known external URLs for this album.
     */
    "external_urls": ExternalUrlObject,
    /**
     * A link to the Web API endpoint providing full details of the album.
     */
    "href": S.String,
    /**
     * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the album.
     */
    "id": S.String,
    /**
     * The cover art for the album in various sizes, widest first.
     */
    "images": S.Array(ImageObject),
    /**
     * The name of the album. In case of an album takedown, the value may be an empty string.
     */
    "name": S.String,
    /**
     * The date the album was first released.
     */
    "release_date": S.String,
    /**
     * The precision with which `release_date` value is known.
     */
    "release_date_precision": ArtistDiscographyAlbumObjectReleaseDatePrecision,
    /**
     * Included in the response when a content restriction is applied.
     */
    "restrictions": S.optionalWith(AlbumRestrictionObject, { nullable: true }),
    /**
     * The object type.
     */
    "type": ArtistDiscographyAlbumObjectType,
    /**
     * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the album.
     */
    "uri": S.String
  })
{}

export class PagingArtistDiscographyAlbumObject
  extends S.Class<PagingArtistDiscographyAlbumObject>("PagingArtistDiscographyAlbumObject")({
    "items": S.Array(ArtistDiscographyAlbumObject),
    /**
     * A link to the Web API endpoint returning the full result of the request
     */
    "href": S.String,
    /**
     * The maximum number of items in the response (as set in the query or by default).
     */
    "limit": S.Int,
    /**
     * URL to the next page of items. ( `null` if none)
     */
    "next": S.NullOr(S.String),
    /**
     * The offset of the items returned (as set in the query or by default)
     */
    "offset": S.Int,
    /**
     * URL to the previous page of items. ( `null` if none)
     */
    "previous": S.NullOr(S.String),
    /**
     * The total number of items available to return.
     */
    "total": S.Int
  })
{}

export class GetAnArtistsAlbums401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtistsAlbums403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtistsAlbums429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtistsTopTracksParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

/**
 * The type of the album.
 */
export class SimplifiedAlbumObjectAlbumType extends S.Literal("album", "single", "compilation") {}

/**
 * The precision with which `release_date` value is known.
 */
export class SimplifiedAlbumObjectReleaseDatePrecision extends S.Literal("year", "month", "day") {}

/**
 * The object type.
 */
export class SimplifiedAlbumObjectType extends S.Literal("album") {}

export class SimplifiedAlbumObject extends S.Class<SimplifiedAlbumObject>("SimplifiedAlbumObject")({
  /**
   * The artists of the album. Each artist object includes a link in `href` to more detailed information about the artist.
   */
  "artists": S.Array(SimplifiedArtistObject),
  /**
   * The type of the album.
   */
  "album_type": SimplifiedAlbumObjectAlbumType,
  /**
   * The number of tracks in the album.
   */
  "total_tracks": S.Int,
  /**
   * The markets in which the album is available: [ISO 3166-1 alpha-2 country codes](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). _**NOTE**: an album is considered available in a market when at least 1 of its tracks is available in that market._
   */
  "available_markets": S.Array(S.String),
  /**
   * Known external URLs for this album.
   */
  "external_urls": ExternalUrlObject,
  /**
   * A link to the Web API endpoint providing full details of the album.
   */
  "href": S.String,
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the album.
   */
  "id": S.String,
  /**
   * The cover art for the album in various sizes, widest first.
   */
  "images": S.Array(ImageObject),
  /**
   * The name of the album. In case of an album takedown, the value may be an empty string.
   */
  "name": S.String,
  /**
   * The date the album was first released.
   */
  "release_date": S.String,
  /**
   * The precision with which `release_date` value is known.
   */
  "release_date_precision": SimplifiedAlbumObjectReleaseDatePrecision,
  /**
   * Included in the response when a content restriction is applied.
   */
  "restrictions": S.optionalWith(AlbumRestrictionObject, { nullable: true }),
  /**
   * The object type.
   */
  "type": SimplifiedAlbumObjectType,
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the album.
   */
  "uri": S.String
}) {}

/**
 * The object type: "track".
 */
export class TrackObjectType extends S.Literal("track") {}

export class TrackObject extends S.Class<TrackObject>("TrackObject")({
  /**
   * The album on which the track appears. The album object includes a link in `href` to full information about the album.
   */
  "album": S.optionalWith(SimplifiedAlbumObject, { nullable: true }),
  /**
   * The artists who performed the track. Each artist object includes a link in `href` to more detailed information about the artist.
   */
  "artists": S.optionalWith(S.Array(SimplifiedArtistObject), { nullable: true }),
  /**
   * A list of the countries in which the track can be played, identified by their [ISO 3166-1 alpha-2](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) code.
   */
  "available_markets": S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * The disc number (usually `1` unless the album consists of more than one disc).
   */
  "disc_number": S.optionalWith(S.Int, { nullable: true }),
  /**
   * The track length in milliseconds.
   */
  "duration_ms": S.optionalWith(S.Int, { nullable: true }),
  /**
   * Whether or not the track has explicit lyrics ( `true` = yes it does; `false` = no it does not OR unknown).
   */
  "explicit": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Known external IDs for the track.
   */
  "external_ids": S.optionalWith(ExternalIdObject, { nullable: true }),
  /**
   * Known external URLs for this track.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * A link to the Web API endpoint providing full details of the track.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the track.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * Part of the response when [Track Relinking](/documentation/web-api/concepts/track-relinking) is applied. If `true`, the track is playable in the given market. Otherwise `false`.
   */
  "is_playable": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Part of the response when [Track Relinking](/documentation/web-api/concepts/track-relinking) is applied, and the requested track has been replaced with different track. The track in the `linked_from` object contains information about the originally requested track.
   */
  "linked_from": S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), { nullable: true }),
  /**
   * Included in the response when a content restriction is applied.
   */
  "restrictions": S.optionalWith(TrackRestrictionObject, { nullable: true }),
  /**
   * The name of the track.
   */
  "name": S.optionalWith(S.String, { nullable: true }),
  /**
   * The popularity of the track. The value will be between 0 and 100, with 100 being the most popular.<br/>The popularity of a track is a value between 0 and 100, with 100 being the most popular. The popularity is calculated by algorithm and is based, in the most part, on the total number of plays the track has had and how recent those plays are.<br/>Generally speaking, songs that are being played a lot now will have a higher popularity than songs that were played a lot in the past. Duplicate tracks (e.g. the same track from a single and an album) are rated independently. Artist and album popularity is derived mathematically from track popularity. _**Note**: the popularity value may lag actual popularity by a few days: the value is not updated in real time._
   */
  "popularity": S.optionalWith(S.Int, { nullable: true }),
  /**
   * A link to a 30 second preview (MP3 format) of the track. Can be `null`
   */
  "preview_url": S.optionalWith(S.String, { nullable: true }),
  /**
   * The number of the track. If an album has several discs, the track number is the number on the specified disc.
   */
  "track_number": S.optionalWith(S.Int, { nullable: true }),
  /**
   * The object type: "track".
   */
  "type": S.optionalWith(TrackObjectType, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the track.
   */
  "uri": S.optionalWith(S.String, { nullable: true }),
  /**
   * Whether or not the track is from a local file.
   */
  "is_local": S.optionalWith(S.Boolean, { nullable: true })
}) {}

export class GetAnArtistsTopTracks200 extends S.Struct({
  "tracks": S.Array(TrackObject)
}) {}

export class GetAnArtistsTopTracks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtistsTopTracks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtistsTopTracks429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtistsRelatedArtistsParams extends S.Struct({}) {}

export class GetAnArtistsRelatedArtists200 extends S.Struct({
  "artists": S.Array(ArtistObject)
}) {}

export class GetAnArtistsRelatedArtists401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtistsRelatedArtists403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnArtistsRelatedArtists429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAShowParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

/**
 * The precision with which `release_date` value is known.
 */
export class SimplifiedEpisodeObjectReleaseDatePrecision extends S.Literal("year", "month", "day") {}

export class ResumePointObject extends S.Class<ResumePointObject>("ResumePointObject")({
  /**
   * Whether or not the episode has been fully played by the user.
   */
  "fully_played": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * The user's most recent position in the episode in milliseconds.
   */
  "resume_position_ms": S.optionalWith(S.Int, { nullable: true })
}) {}

/**
 * The object type.
 */
export class SimplifiedEpisodeObjectType extends S.Literal("episode") {}

export class EpisodeRestrictionObject extends S.Class<EpisodeRestrictionObject>("EpisodeRestrictionObject")({
  /**
   * The reason for the restriction. Supported values:
   * - `market` - The content item is not available in the given market.
   * - `product` - The content item is not available for the user's subscription type.
   * - `explicit` - The content item is explicit and the user's account is set to not play explicit content.
   *
   * Additional reasons may be added in the future.
   * **Note**: If you use this field, make sure that your application safely handles unknown values.
   */
  "reason": S.optionalWith(S.String, { nullable: true })
}) {}

export class SimplifiedEpisodeObject extends S.Class<SimplifiedEpisodeObject>("SimplifiedEpisodeObject")({
  /**
   * A URL to a 30 second preview (MP3 format) of the episode. `null` if not available.
   */
  "audio_preview_url": S.NullOr(S.String),
  /**
   * A description of the episode. HTML tags are stripped away from this field, use `html_description` field in case HTML tags are needed.
   */
  "description": S.String,
  /**
   * A description of the episode. This field may contain HTML tags.
   */
  "html_description": S.String,
  /**
   * The episode length in milliseconds.
   */
  "duration_ms": S.Int,
  /**
   * Whether or not the episode has explicit content (true = yes it does; false = no it does not OR unknown).
   */
  "explicit": S.Boolean,
  /**
   * External URLs for this episode.
   */
  "external_urls": ExternalUrlObject,
  /**
   * A link to the Web API endpoint providing full details of the episode.
   */
  "href": S.String,
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the episode.
   */
  "id": S.String,
  /**
   * The cover art for the episode in various sizes, widest first.
   */
  "images": S.Array(ImageObject),
  /**
   * True if the episode is hosted outside of Spotify's CDN.
   */
  "is_externally_hosted": S.Boolean,
  /**
   * True if the episode is playable in the given market. Otherwise false.
   */
  "is_playable": S.Boolean,
  /**
   * The language used in the episode, identified by a [ISO 639](https://en.wikipedia.org/wiki/ISO_639) code. This field is deprecated and might be removed in the future. Please use the `languages` field instead.
   */
  "language": S.optionalWith(S.String, { nullable: true }),
  /**
   * A list of the languages used in the episode, identified by their [ISO 639-1](https://en.wikipedia.org/wiki/ISO_639) code.
   */
  "languages": S.Array(S.String),
  /**
   * The name of the episode.
   */
  "name": S.String,
  /**
   * The date the episode was first released, for example `"1981-12-15"`. Depending on the precision, it might be shown as `"1981"` or `"1981-12"`.
   */
  "release_date": S.String,
  /**
   * The precision with which `release_date` value is known.
   */
  "release_date_precision": SimplifiedEpisodeObjectReleaseDatePrecision,
  /**
   * The user's most recent position in the episode. Set if the supplied access token is a user token and has the scope 'user-read-playback-position'.
   */
  "resume_point": S.optionalWith(ResumePointObject, { nullable: true }),
  /**
   * The object type.
   */
  "type": SimplifiedEpisodeObjectType,
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the episode.
   */
  "uri": S.String,
  /**
   * Included in the response when a content restriction is applied.
   */
  "restrictions": S.optionalWith(EpisodeRestrictionObject, { nullable: true })
}) {}

export class PagingSimplifiedEpisodeObject
  extends S.Class<PagingSimplifiedEpisodeObject>("PagingSimplifiedEpisodeObject")({
    "items": S.Array(SimplifiedEpisodeObject),
    /**
     * A link to the Web API endpoint returning the full result of the request
     */
    "href": S.String,
    /**
     * The maximum number of items in the response (as set in the query or by default).
     */
    "limit": S.Int,
    /**
     * URL to the next page of items. ( `null` if none)
     */
    "next": S.NullOr(S.String),
    /**
     * The offset of the items returned (as set in the query or by default)
     */
    "offset": S.Int,
    /**
     * URL to the previous page of items. ( `null` if none)
     */
    "previous": S.NullOr(S.String),
    /**
     * The total number of items available to return.
     */
    "total": S.Int
  })
{}

/**
 * The object type.
 */
export class ShowObjectType extends S.Literal("show") {}

export class ShowObject extends S.Class<ShowObject>("ShowObject")({
  /**
   * The episodes of the show.
   */
  "episodes": S.Record({ key: S.String, value: S.Unknown }),
  /**
   * A list of the countries in which the show can be played, identified by their [ISO 3166-1 alpha-2](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) code.
   */
  "available_markets": S.Array(S.String),
  /**
   * The copyright statements of the show.
   */
  "copyrights": S.Array(CopyrightObject),
  /**
   * A description of the show. HTML tags are stripped away from this field, use `html_description` field in case HTML tags are needed.
   */
  "description": S.String,
  /**
   * A description of the show. This field may contain HTML tags.
   */
  "html_description": S.String,
  /**
   * Whether or not the show has explicit content (true = yes it does; false = no it does not OR unknown).
   */
  "explicit": S.Boolean,
  /**
   * External URLs for this show.
   */
  "external_urls": ExternalUrlObject,
  /**
   * A link to the Web API endpoint providing full details of the show.
   */
  "href": S.String,
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the show.
   */
  "id": S.String,
  /**
   * The cover art for the show in various sizes, widest first.
   */
  "images": S.Array(ImageObject),
  /**
   * True if all of the shows episodes are hosted outside of Spotify's CDN. This field might be `null` in some cases.
   */
  "is_externally_hosted": S.Boolean,
  /**
   * A list of the languages used in the show, identified by their [ISO 639](https://en.wikipedia.org/wiki/ISO_639) code.
   */
  "languages": S.Array(S.String),
  /**
   * The media type of the show.
   */
  "media_type": S.String,
  /**
   * The name of the episode.
   */
  "name": S.String,
  /**
   * The publisher of the show.
   */
  "publisher": S.String,
  /**
   * The object type.
   */
  "type": ShowObjectType,
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the show.
   */
  "uri": S.String,
  /**
   * The total number of episodes in the show.
   */
  "total_episodes": S.Int
}) {}

export class GetAShow401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAShow403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAShow429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleShowsParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the shows. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

/**
 * The object type.
 */
export class SimplifiedShowObjectType extends S.Literal("show") {}

export class SimplifiedShowObject extends S.Class<SimplifiedShowObject>("SimplifiedShowObject")({
  /**
   * A list of the countries in which the show can be played, identified by their [ISO 3166-1 alpha-2](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) code.
   */
  "available_markets": S.Array(S.String),
  /**
   * The copyright statements of the show.
   */
  "copyrights": S.Array(CopyrightObject),
  /**
   * A description of the show. HTML tags are stripped away from this field, use `html_description` field in case HTML tags are needed.
   */
  "description": S.String,
  /**
   * A description of the show. This field may contain HTML tags.
   */
  "html_description": S.String,
  /**
   * Whether or not the show has explicit content (true = yes it does; false = no it does not OR unknown).
   */
  "explicit": S.Boolean,
  /**
   * External URLs for this show.
   */
  "external_urls": ExternalUrlObject,
  /**
   * A link to the Web API endpoint providing full details of the show.
   */
  "href": S.String,
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the show.
   */
  "id": S.String,
  /**
   * The cover art for the show in various sizes, widest first.
   */
  "images": S.Array(ImageObject),
  /**
   * True if all of the shows episodes are hosted outside of Spotify's CDN. This field might be `null` in some cases.
   */
  "is_externally_hosted": S.Boolean,
  /**
   * A list of the languages used in the show, identified by their [ISO 639](https://en.wikipedia.org/wiki/ISO_639) code.
   */
  "languages": S.Array(S.String),
  /**
   * The media type of the show.
   */
  "media_type": S.String,
  /**
   * The name of the episode.
   */
  "name": S.String,
  /**
   * The publisher of the show.
   */
  "publisher": S.String,
  /**
   * The object type.
   */
  "type": SimplifiedShowObjectType,
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the show.
   */
  "uri": S.String,
  /**
   * The total number of episodes in the show.
   */
  "total_episodes": S.Int
}) {}

export class GetMultipleShows200 extends S.Struct({
  "shows": S.Array(SimplifiedShowObject)
}) {}

export class GetMultipleShows401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleShows403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleShows429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAShowsEpisodesParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class GetAShowsEpisodes401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAShowsEpisodes403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAShowsEpisodes429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnEpisodeParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

/**
 * The precision with which `release_date` value is known.
 */
export class EpisodeObjectReleaseDatePrecision extends S.Literal("year", "month", "day") {}

/**
 * The object type.
 */
export class EpisodeObjectType extends S.Literal("episode") {}

export class EpisodeObject extends S.Class<EpisodeObject>("EpisodeObject")({
  /**
   * The show on which the episode belongs.
   */
  "show": SimplifiedShowObject,
  /**
   * A URL to a 30 second preview (MP3 format) of the episode. `null` if not available.
   */
  "audio_preview_url": S.NullOr(S.String),
  /**
   * A description of the episode. HTML tags are stripped away from this field, use `html_description` field in case HTML tags are needed.
   */
  "description": S.String,
  /**
   * A description of the episode. This field may contain HTML tags.
   */
  "html_description": S.String,
  /**
   * The episode length in milliseconds.
   */
  "duration_ms": S.Int,
  /**
   * Whether or not the episode has explicit content (true = yes it does; false = no it does not OR unknown).
   */
  "explicit": S.Boolean,
  /**
   * External URLs for this episode.
   */
  "external_urls": ExternalUrlObject,
  /**
   * A link to the Web API endpoint providing full details of the episode.
   */
  "href": S.String,
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the episode.
   */
  "id": S.String,
  /**
   * The cover art for the episode in various sizes, widest first.
   */
  "images": S.Array(ImageObject),
  /**
   * True if the episode is hosted outside of Spotify's CDN.
   */
  "is_externally_hosted": S.Boolean,
  /**
   * True if the episode is playable in the given market. Otherwise false.
   */
  "is_playable": S.Boolean,
  /**
   * The language used in the episode, identified by a [ISO 639](https://en.wikipedia.org/wiki/ISO_639) code. This field is deprecated and might be removed in the future. Please use the `languages` field instead.
   */
  "language": S.optionalWith(S.String, { nullable: true }),
  /**
   * A list of the languages used in the episode, identified by their [ISO 639-1](https://en.wikipedia.org/wiki/ISO_639) code.
   */
  "languages": S.Array(S.String),
  /**
   * The name of the episode.
   */
  "name": S.String,
  /**
   * The date the episode was first released, for example `"1981-12-15"`. Depending on the precision, it might be shown as `"1981"` or `"1981-12"`.
   */
  "release_date": S.String,
  /**
   * The precision with which `release_date` value is known.
   */
  "release_date_precision": EpisodeObjectReleaseDatePrecision,
  /**
   * The user's most recent position in the episode. Set if the supplied access token is a user token and has the scope 'user-read-playback-position'.
   */
  "resume_point": S.optionalWith(ResumePointObject, { nullable: true }),
  /**
   * The object type.
   */
  "type": EpisodeObjectType,
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the episode.
   */
  "uri": S.String,
  /**
   * Included in the response when a content restriction is applied.
   */
  "restrictions": S.optionalWith(EpisodeRestrictionObject, { nullable: true })
}) {}

export class GetAnEpisode401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnEpisode403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnEpisode429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleEpisodesParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the episodes. Maximum: 50 IDs.
   */
  "ids": S.String,
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetMultipleEpisodes200 extends S.Struct({
  "episodes": S.Array(EpisodeObject)
}) {}

export class GetMultipleEpisodes401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleEpisodes403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleEpisodes429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnAudiobookParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

/**
 * The precision with which `release_date` value is known.
 */
export class SimplifiedChapterObjectReleaseDatePrecision extends S.Literal("year", "month", "day") {}

/**
 * The object type.
 */
export class SimplifiedChapterObjectType extends S.Literal("episode") {}

export class ChapterRestrictionObject extends S.Class<ChapterRestrictionObject>("ChapterRestrictionObject")({
  /**
   * The reason for the restriction. Supported values:
   * - `market` - The content item is not available in the given market.
   * - `product` - The content item is not available for the user's subscription type.
   * - `explicit` - The content item is explicit and the user's account is set to not play explicit content.
   * - `payment_required` - Payment is required to play the content item.
   *
   * Additional reasons may be added in the future.
   * **Note**: If you use this field, make sure that your application safely handles unknown values.
   */
  "reason": S.optionalWith(S.String, { nullable: true })
}) {}

export class SimplifiedChapterObject extends S.Class<SimplifiedChapterObject>("SimplifiedChapterObject")({
  /**
   * A URL to a 30 second preview (MP3 format) of the chapter. `null` if not available.
   */
  "audio_preview_url": S.NullOr(S.String),
  /**
   * A list of the countries in which the chapter can be played, identified by their [ISO 3166-1 alpha-2](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) code.
   */
  "available_markets": S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * The number of the chapter
   */
  "chapter_number": S.Int,
  /**
   * A description of the chapter. HTML tags are stripped away from this field, use `html_description` field in case HTML tags are needed.
   */
  "description": S.String,
  /**
   * A description of the chapter. This field may contain HTML tags.
   */
  "html_description": S.String,
  /**
   * The chapter length in milliseconds.
   */
  "duration_ms": S.Int,
  /**
   * Whether or not the chapter has explicit content (true = yes it does; false = no it does not OR unknown).
   */
  "explicit": S.Boolean,
  /**
   * External URLs for this chapter.
   */
  "external_urls": ExternalUrlObject,
  /**
   * A link to the Web API endpoint providing full details of the chapter.
   */
  "href": S.String,
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the chapter.
   */
  "id": S.String,
  /**
   * The cover art for the chapter in various sizes, widest first.
   */
  "images": S.Array(ImageObject),
  /**
   * True if the chapter is playable in the given market. Otherwise false.
   */
  "is_playable": S.Boolean,
  /**
   * A list of the languages used in the chapter, identified by their [ISO 639-1](https://en.wikipedia.org/wiki/ISO_639) code.
   */
  "languages": S.Array(S.String),
  /**
   * The name of the chapter.
   */
  "name": S.String,
  /**
   * The date the chapter was first released, for example `"1981-12-15"`. Depending on the precision, it might be shown as `"1981"` or `"1981-12"`.
   */
  "release_date": S.String,
  /**
   * The precision with which `release_date` value is known.
   */
  "release_date_precision": SimplifiedChapterObjectReleaseDatePrecision,
  /**
   * The user's most recent position in the chapter. Set if the supplied access token is a user token and has the scope 'user-read-playback-position'.
   */
  "resume_point": S.optionalWith(ResumePointObject, { nullable: true }),
  /**
   * The object type.
   */
  "type": SimplifiedChapterObjectType,
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the chapter.
   */
  "uri": S.String,
  /**
   * Included in the response when a content restriction is applied.
   */
  "restrictions": S.optionalWith(ChapterRestrictionObject, { nullable: true })
}) {}

export class PagingSimplifiedChapterObject
  extends S.Class<PagingSimplifiedChapterObject>("PagingSimplifiedChapterObject")({
    "items": S.Array(SimplifiedChapterObject),
    /**
     * A link to the Web API endpoint returning the full result of the request
     */
    "href": S.String,
    /**
     * The maximum number of items in the response (as set in the query or by default).
     */
    "limit": S.Int,
    /**
     * URL to the next page of items. ( `null` if none)
     */
    "next": S.NullOr(S.String),
    /**
     * The offset of the items returned (as set in the query or by default)
     */
    "offset": S.Int,
    /**
     * URL to the previous page of items. ( `null` if none)
     */
    "previous": S.NullOr(S.String),
    /**
     * The total number of items available to return.
     */
    "total": S.Int
  })
{}

export class AuthorObject extends S.Class<AuthorObject>("AuthorObject")({
  /**
   * The name of the author.
   */
  "name": S.optionalWith(S.String, { nullable: true })
}) {}

export class NarratorObject extends S.Class<NarratorObject>("NarratorObject")({
  /**
   * The name of the Narrator.
   */
  "name": S.optionalWith(S.String, { nullable: true })
}) {}

/**
 * The object type.
 */
export class AudiobookObjectType extends S.Literal("audiobook") {}

export class AudiobookObject extends S.Class<AudiobookObject>("AudiobookObject")({
  /**
   * The chapters of the audiobook.
   */
  "chapters": S.Record({ key: S.String, value: S.Unknown }),
  /**
   * The author(s) for the audiobook.
   */
  "authors": S.Array(AuthorObject),
  /**
   * A list of the countries in which the audiobook can be played, identified by their [ISO 3166-1 alpha-2](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) code.
   */
  "available_markets": S.Array(S.String),
  /**
   * The copyright statements of the audiobook.
   */
  "copyrights": S.Array(CopyrightObject),
  /**
   * A description of the audiobook. HTML tags are stripped away from this field, use `html_description` field in case HTML tags are needed.
   */
  "description": S.String,
  /**
   * A description of the audiobook. This field may contain HTML tags.
   */
  "html_description": S.String,
  /**
   * The edition of the audiobook.
   */
  "edition": S.optionalWith(S.String, { nullable: true }),
  /**
   * Whether or not the audiobook has explicit content (true = yes it does; false = no it does not OR unknown).
   */
  "explicit": S.Boolean,
  /**
   * External URLs for this audiobook.
   */
  "external_urls": ExternalUrlObject,
  /**
   * A link to the Web API endpoint providing full details of the audiobook.
   */
  "href": S.String,
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the audiobook.
   */
  "id": S.String,
  /**
   * The cover art for the audiobook in various sizes, widest first.
   */
  "images": S.Array(ImageObject),
  /**
   * A list of the languages used in the audiobook, identified by their [ISO 639](https://en.wikipedia.org/wiki/ISO_639) code.
   */
  "languages": S.Array(S.String),
  /**
   * The media type of the audiobook.
   */
  "media_type": S.String,
  /**
   * The name of the audiobook.
   */
  "name": S.String,
  /**
   * The narrator(s) for the audiobook.
   */
  "narrators": S.Array(NarratorObject),
  /**
   * The publisher of the audiobook.
   */
  "publisher": S.String,
  /**
   * The object type.
   */
  "type": AudiobookObjectType,
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the audiobook.
   */
  "uri": S.String,
  /**
   * The number of chapters in this audiobook.
   */
  "total_chapters": S.Int
}) {}

export class GetAnAudiobook400 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnAudiobook401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnAudiobook403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnAudiobook404 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAnAudiobook429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleAudiobooksParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=18yVqkdbdRvS24c0Ilj2ci,1HGw3J3NxZO1TP1BTtVhpZ`. Maximum: 50 IDs.
   */
  "ids": S.String,
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetMultipleAudiobooks200 extends S.Struct({
  "audiobooks": S.Array(AudiobookObject)
}) {}

export class GetMultipleAudiobooks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleAudiobooks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetMultipleAudiobooks429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAudiobookChaptersParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class GetAudiobookChapters401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAudiobookChapters403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAudiobookChapters429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedAudiobooksParams extends S.Struct({
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

/**
 * The object type.
 */
export class SimplifiedAudiobookObjectType extends S.Literal("audiobook") {}

export class SimplifiedAudiobookObject extends S.Class<SimplifiedAudiobookObject>("SimplifiedAudiobookObject")({
  /**
   * The author(s) for the audiobook.
   */
  "authors": S.Array(AuthorObject),
  /**
   * A list of the countries in which the audiobook can be played, identified by their [ISO 3166-1 alpha-2](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) code.
   */
  "available_markets": S.Array(S.String),
  /**
   * The copyright statements of the audiobook.
   */
  "copyrights": S.Array(CopyrightObject),
  /**
   * A description of the audiobook. HTML tags are stripped away from this field, use `html_description` field in case HTML tags are needed.
   */
  "description": S.String,
  /**
   * A description of the audiobook. This field may contain HTML tags.
   */
  "html_description": S.String,
  /**
   * The edition of the audiobook.
   */
  "edition": S.optionalWith(S.String, { nullable: true }),
  /**
   * Whether or not the audiobook has explicit content (true = yes it does; false = no it does not OR unknown).
   */
  "explicit": S.Boolean,
  /**
   * External URLs for this audiobook.
   */
  "external_urls": ExternalUrlObject,
  /**
   * A link to the Web API endpoint providing full details of the audiobook.
   */
  "href": S.String,
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the audiobook.
   */
  "id": S.String,
  /**
   * The cover art for the audiobook in various sizes, widest first.
   */
  "images": S.Array(ImageObject),
  /**
   * A list of the languages used in the audiobook, identified by their [ISO 639](https://en.wikipedia.org/wiki/ISO_639) code.
   */
  "languages": S.Array(S.String),
  /**
   * The media type of the audiobook.
   */
  "media_type": S.String,
  /**
   * The name of the audiobook.
   */
  "name": S.String,
  /**
   * The narrator(s) for the audiobook.
   */
  "narrators": S.Array(NarratorObject),
  /**
   * The publisher of the audiobook.
   */
  "publisher": S.String,
  /**
   * The object type.
   */
  "type": SimplifiedAudiobookObjectType,
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the audiobook.
   */
  "uri": S.String,
  /**
   * The number of chapters in this audiobook.
   */
  "total_chapters": S.Int
}) {}

export class PagingSimplifiedAudiobookObject
  extends S.Class<PagingSimplifiedAudiobookObject>("PagingSimplifiedAudiobookObject")({
    "items": S.Array(SimplifiedAudiobookObject),
    /**
     * A link to the Web API endpoint returning the full result of the request
     */
    "href": S.String,
    /**
     * The maximum number of items in the response (as set in the query or by default).
     */
    "limit": S.Int,
    /**
     * URL to the next page of items. ( `null` if none)
     */
    "next": S.NullOr(S.String),
    /**
     * The offset of the items returned (as set in the query or by default)
     */
    "offset": S.Int,
    /**
     * URL to the previous page of items. ( `null` if none)
     */
    "previous": S.NullOr(S.String),
    /**
     * The total number of items available to return.
     */
    "total": S.Int
  })
{}

export class GetUsersSavedAudiobooks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedAudiobooks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedAudiobooks429 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveAudiobooksUserParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=18yVqkdbdRvS24c0Ilj2ci,1HGw3J3NxZO1TP1BTtVhpZ`. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class SaveAudiobooksUser401 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveAudiobooksUser403 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveAudiobooksUser429 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveAudiobooksUserParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=18yVqkdbdRvS24c0Ilj2ci,1HGw3J3NxZO1TP1BTtVhpZ`. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class RemoveAudiobooksUser401 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveAudiobooksUser403 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveAudiobooksUser429 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedAudiobooksParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=18yVqkdbdRvS24c0Ilj2ci,1HGw3J3NxZO1TP1BTtVhpZ`. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class CheckUsersSavedAudiobooks200 extends S.Array(S.Boolean) {}

export class CheckUsersSavedAudiobooks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedAudiobooks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedAudiobooks429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAChapterParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

/**
 * The precision with which `release_date` value is known.
 */
export class ChapterObjectReleaseDatePrecision extends S.Literal("year", "month", "day") {}

/**
 * The object type.
 */
export class ChapterObjectType extends S.Literal("episode") {}

export class ChapterObject extends S.Class<ChapterObject>("ChapterObject")({
  /**
   * The audiobook for which the chapter belongs.
   */
  "audiobook": SimplifiedAudiobookObject,
  /**
   * A URL to a 30 second preview (MP3 format) of the chapter. `null` if not available.
   */
  "audio_preview_url": S.NullOr(S.String),
  /**
   * A list of the countries in which the chapter can be played, identified by their [ISO 3166-1 alpha-2](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) code.
   */
  "available_markets": S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * The number of the chapter
   */
  "chapter_number": S.Int,
  /**
   * A description of the chapter. HTML tags are stripped away from this field, use `html_description` field in case HTML tags are needed.
   */
  "description": S.String,
  /**
   * A description of the chapter. This field may contain HTML tags.
   */
  "html_description": S.String,
  /**
   * The chapter length in milliseconds.
   */
  "duration_ms": S.Int,
  /**
   * Whether or not the chapter has explicit content (true = yes it does; false = no it does not OR unknown).
   */
  "explicit": S.Boolean,
  /**
   * External URLs for this chapter.
   */
  "external_urls": ExternalUrlObject,
  /**
   * A link to the Web API endpoint providing full details of the chapter.
   */
  "href": S.String,
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the chapter.
   */
  "id": S.String,
  /**
   * The cover art for the chapter in various sizes, widest first.
   */
  "images": S.Array(ImageObject),
  /**
   * True if the chapter is playable in the given market. Otherwise false.
   */
  "is_playable": S.Boolean,
  /**
   * A list of the languages used in the chapter, identified by their [ISO 639-1](https://en.wikipedia.org/wiki/ISO_639) code.
   */
  "languages": S.Array(S.String),
  /**
   * The name of the chapter.
   */
  "name": S.String,
  /**
   * The date the chapter was first released, for example `"1981-12-15"`. Depending on the precision, it might be shown as `"1981"` or `"1981-12"`.
   */
  "release_date": S.String,
  /**
   * The precision with which `release_date` value is known.
   */
  "release_date_precision": ChapterObjectReleaseDatePrecision,
  /**
   * The user's most recent position in the chapter. Set if the supplied access token is a user token and has the scope 'user-read-playback-position'.
   */
  "resume_point": S.optionalWith(ResumePointObject, { nullable: true }),
  /**
   * The object type.
   */
  "type": ChapterObjectType,
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the chapter.
   */
  "uri": S.String,
  /**
   * Included in the response when a content restriction is applied.
   */
  "restrictions": S.optionalWith(ChapterRestrictionObject, { nullable: true })
}) {}

export class GetAChapter401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAChapter403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAChapter429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetSeveralChaptersParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=0IsXVP0JmcB2adSE338GkK,3ZXb8FKZGU0EHALYX6uCzU`. Maximum: 50 IDs.
   */
  "ids": S.String,
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetSeveralChapters200 extends S.Struct({
  "chapters": S.Array(ChapterObject)
}) {}

export class GetSeveralChapters401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetSeveralChapters403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetSeveralChapters429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetTrackParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetTrack401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetTrack403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetTrack429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetSeveralTracksParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=4iV5W9uYEdYUVa79Axb7Rh,1301WleyT98MSxVHPZCA6M`. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class GetSeveralTracks200 extends S.Struct({
  "tracks": S.Array(TrackObject)
}) {}

export class GetSeveralTracks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetSeveralTracks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetSeveralTracks429 extends S.Struct({
  "error": ErrorObject
}) {}

/**
 * If `include_external=audio` is specified it signals that the client can play externally hosted audio content, and marks
 * the content as playable in the response. By default externally hosted audio content is marked as unplayable in the response.
 */
export class SearchParamsIncludeExternal extends S.Literal("audio") {}

export class SearchParams extends S.Struct({
  /**
   * Your search query.
   *
   * You can narrow down your search using field filters. The available filters are `album`, `artist`, `track`, `year`, `upc`, `tag:hipster`, `tag:new`, `isrc`, and `genre`. Each field filter only applies to certain result types.
   *
   * The `artist` and `year` filters can be used while searching albums, artists and tracks. You can filter on a single `year` or a range (e.g. 1955-1960).<br />
   * The `album` filter can be used while searching albums and tracks.<br />
   * The `genre` filter can be used while searching artists and tracks.<br />
   * The `isrc` and `track` filters can be used while searching tracks.<br />
   * The `upc`, `tag:new` and `tag:hipster` filters can only be used while searching albums. The `tag:new` filter will return albums released in the past two weeks and `tag:hipster` can be used to return only albums with the lowest 10% popularity.<br />
   */
  "q": S.String,
  /**
   * A comma-separated list of item types to search across. Search results include hits
   * from all the specified item types. For example: `q=abacab&type=album,track` returns
   * both albums and tracks matching "abacab".
   */
  "type": S.Array(S.Literal("album", "artist", "playlist", "track", "show", "episode", "audiobook")),
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of results to return in each item type.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first result to return. Use
   * with limit to get the next page of search results.
   */
  "offset": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1000)), {
    nullable: true,
    default: () => 0 as const
  }),
  /**
   * If `include_external=audio` is specified it signals that the client can play externally hosted audio content, and marks
   * the content as playable in the response. By default externally hosted audio content is marked as unplayable in the response.
   */
  "include_external": S.optionalWith(SearchParamsIncludeExternal, { nullable: true })
}) {}

export class PagingTrackObject extends S.Class<PagingTrackObject>("PagingTrackObject")({
  "items": S.Array(TrackObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class PagingArtistObject extends S.Class<PagingArtistObject>("PagingArtistObject")({
  "items": S.Array(ArtistObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class PagingSimplifiedAlbumObject extends S.Class<PagingSimplifiedAlbumObject>("PagingSimplifiedAlbumObject")({
  "items": S.Array(SimplifiedAlbumObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

/**
 * The object type.
 */
export class PlaylistOwnerObjectType extends S.Literal("user") {}

export class PlaylistOwnerObject extends S.Class<PlaylistOwnerObject>("PlaylistOwnerObject")({
  /**
   * The name displayed on the user's profile. `null` if not available.
   */
  "display_name": S.optionalWith(S.String, { nullable: true }),
  /**
   * Known public external URLs for this user.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * A link to the Web API endpoint for this user.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify user ID](/documentation/web-api/concepts/spotify-uris-ids) for this user.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * The object type.
   */
  "type": S.optionalWith(PlaylistOwnerObjectType, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for this user.
   */
  "uri": S.optionalWith(S.String, { nullable: true })
}) {}

export class PlaylistTracksRefObject extends S.Class<PlaylistTracksRefObject>("PlaylistTracksRefObject")({
  /**
   * A link to the Web API endpoint where full details of the playlist's tracks can be retrieved.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * Number of tracks in the playlist.
   */
  "total": S.optionalWith(S.Int, { nullable: true })
}) {}

export class SimplifiedPlaylistObject extends S.Class<SimplifiedPlaylistObject>("SimplifiedPlaylistObject")({
  /**
   * `true` if the owner allows other users to modify the playlist.
   */
  "collaborative": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * The playlist description. _Only returned for modified, verified playlists, otherwise_ `null`.
   */
  "description": S.optionalWith(S.String, { nullable: true }),
  /**
   * Known external URLs for this playlist.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * A link to the Web API endpoint providing full details of the playlist.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the playlist.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * Images for the playlist. The array may be empty or contain up to three images. The images are returned by size in descending order. See [Working with Playlists](/documentation/web-api/concepts/playlists). _**Note**: If returned, the source URL for the image (`url`) is temporary and will expire in less than a day._
   */
  "images": S.optionalWith(S.Array(ImageObject), { nullable: true }),
  /**
   * The name of the playlist.
   */
  "name": S.optionalWith(S.String, { nullable: true }),
  /**
   * The user who owns the playlist
   */
  "owner": S.optionalWith(PlaylistOwnerObject, { nullable: true }),
  /**
   * The playlist's public/private status (if it is added to the user's profile): `true` the playlist is public, `false` the playlist is private, `null` the playlist status is not relevant. For more about public/private status, see [Working with Playlists](/documentation/web-api/concepts/playlists)
   */
  "public": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * The version identifier for the current playlist. Can be supplied in other requests to target a specific playlist version
   */
  "snapshot_id": S.optionalWith(S.String, { nullable: true }),
  /**
   * A collection containing a link ( `href` ) to the Web API endpoint where full details of the playlist's tracks can be retrieved, along with the `total` number of tracks in the playlist. Note, a track object may be `null`. This can happen if a track is no longer available.
   */
  "tracks": S.optionalWith(PlaylistTracksRefObject, { nullable: true }),
  /**
   * The object type: "playlist"
   */
  "type": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the playlist.
   */
  "uri": S.optionalWith(S.String, { nullable: true })
}) {}

export class PagingPlaylistObject extends S.Class<PagingPlaylistObject>("PagingPlaylistObject")({
  "items": S.Array(SimplifiedPlaylistObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class PagingSimplifiedShowObject extends S.Class<PagingSimplifiedShowObject>("PagingSimplifiedShowObject")({
  "items": S.Array(SimplifiedShowObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class Search200 extends S.Struct({
  "tracks": S.optionalWith(PagingTrackObject, { nullable: true }),
  "artists": S.optionalWith(PagingArtistObject, { nullable: true }),
  "albums": S.optionalWith(PagingSimplifiedAlbumObject, { nullable: true }),
  "playlists": S.optionalWith(PagingPlaylistObject, { nullable: true }),
  "shows": S.optionalWith(PagingSimplifiedShowObject, { nullable: true }),
  "episodes": S.optionalWith(PagingSimplifiedEpisodeObject, { nullable: true }),
  "audiobooks": S.optionalWith(PagingSimplifiedAudiobookObject, { nullable: true })
}) {}

export class Search401 extends S.Struct({
  "error": ErrorObject
}) {}

export class Search403 extends S.Struct({
  "error": ErrorObject
}) {}

export class Search429 extends S.Struct({
  "error": ErrorObject
}) {}

export class ExplicitContentSettingsObject
  extends S.Class<ExplicitContentSettingsObject>("ExplicitContentSettingsObject")({
    /**
     * When `true`, indicates that explicit content should not be played.
     */
    "filter_enabled": S.optionalWith(S.Boolean, { nullable: true }),
    /**
     * When `true`, indicates that the explicit content setting is locked and can't be changed by the user.
     */
    "filter_locked": S.optionalWith(S.Boolean, { nullable: true })
  })
{}

export class PrivateUserObject extends S.Class<PrivateUserObject>("PrivateUserObject")({
  /**
   * The country of the user, as set in the user's account profile. An [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). _This field is only available when the current user has granted access to the [user-read-private](/documentation/web-api/concepts/scopes/#list-of-scopes) scope._
   */
  "country": S.optionalWith(S.String, { nullable: true }),
  /**
   * The name displayed on the user's profile. `null` if not available.
   */
  "display_name": S.optionalWith(S.String, { nullable: true }),
  /**
   * The user's email address, as entered by the user when creating their account. _**Important!** This email address is unverified; there is no proof that it actually belongs to the user._ _This field is only available when the current user has granted access to the [user-read-email](/documentation/web-api/concepts/scopes/#list-of-scopes) scope._
   */
  "email": S.optionalWith(S.String, { nullable: true }),
  /**
   * The user's explicit content settings. _This field is only available when the current user has granted access to the [user-read-private](/documentation/web-api/concepts/scopes/#list-of-scopes) scope._
   */
  "explicit_content": S.optionalWith(ExplicitContentSettingsObject, { nullable: true }),
  /**
   * Known external URLs for this user.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * Information about the followers of the user.
   */
  "followers": S.optionalWith(FollowersObject, { nullable: true }),
  /**
   * A link to the Web API endpoint for this user.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify user ID](/documentation/web-api/concepts/spotify-uris-ids) for the user.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * The user's profile image.
   */
  "images": S.optionalWith(S.Array(ImageObject), { nullable: true }),
  /**
   * The user's Spotify subscription level: "premium", "free", etc. (The subscription level "open" can be considered the same as "free".) _This field is only available when the current user has granted access to the [user-read-private](/documentation/web-api/concepts/scopes/#list-of-scopes) scope._
   */
  "product": S.optionalWith(S.String, { nullable: true }),
  /**
   * The object type: "user"
   */
  "type": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the user.
   */
  "uri": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetCurrentUsersProfile401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetCurrentUsersProfile403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetCurrentUsersProfile429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetPlaylistParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * Filters for the query: a comma-separated list of the
   * fields to return. If omitted, all fields are returned. For example, to get
   * just the playlist''s description and URI: `fields=description,uri`. A dot
   * separator can be used to specify non-reoccurring fields, while parentheses
   * can be used to specify reoccurring fields within objects. For example, to
   * get just the added date and user ID of the adder: `fields=tracks.items(added_at,added_by.id)`.
   * Use multiple parentheses to drill down into nested objects, for example: `fields=tracks.items(track(name,href,album(name,href)))`.
   * Fields can be excluded by prefixing them with an exclamation mark, for example:
   * `fields=tracks.items(track(name,href,album(!name,href)))`
   */
  "fields": S.optionalWith(S.String, { nullable: true }),
  /**
   * A comma-separated list of item types that your client supports besides the default `track` type. Valid types are: `track` and `episode`.<br/>
   * _**Note**: This parameter was introduced to allow existing clients to maintain their current behaviour and might be deprecated in the future._<br/>
   * In addition to providing this parameter, make sure that your client properly handles cases of new types in the future by checking against the `type` field of each object.
   */
  "additional_types": S.optionalWith(S.String, { nullable: true })
}) {}

/**
 * The object type.
 */
export class PlaylistUserObjectType extends S.Literal("user") {}

export class PlaylistUserObject extends S.Class<PlaylistUserObject>("PlaylistUserObject")({
  /**
   * Known public external URLs for this user.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * A link to the Web API endpoint for this user.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify user ID](/documentation/web-api/concepts/spotify-uris-ids) for this user.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * The object type.
   */
  "type": S.optionalWith(PlaylistUserObjectType, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for this user.
   */
  "uri": S.optionalWith(S.String, { nullable: true })
}) {}

export class PlaylistTrackObject extends S.Class<PlaylistTrackObject>("PlaylistTrackObject")({
  /**
   * The date and time the track or episode was added. _**Note**: some very old playlists may return `null` in this field._
   */
  "added_at": S.optionalWith(S.String, { nullable: true }),
  /**
   * The Spotify user who added the track or episode. _**Note**: some very old playlists may return `null` in this field._
   */
  "added_by": S.optionalWith(PlaylistUserObject, { nullable: true }),
  /**
   * Whether this track or episode is a [local file](/documentation/web-api/concepts/playlists/#local-files) or not.
   */
  "is_local": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Information about the track or episode.
   */
  "track": S.optionalWith(S.Union(TrackObject, EpisodeObject), { nullable: true })
}) {}

export class PagingPlaylistTrackObject extends S.Class<PagingPlaylistTrackObject>("PagingPlaylistTrackObject")({
  "items": S.Array(PlaylistTrackObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class PlaylistObject extends S.Class<PlaylistObject>("PlaylistObject")({
  /**
   * `true` if the owner allows other users to modify the playlist.
   */
  "collaborative": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * The playlist description. _Only returned for modified, verified playlists, otherwise_ `null`.
   */
  "description": S.optionalWith(S.String, { nullable: true }),
  /**
   * Known external URLs for this playlist.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * A link to the Web API endpoint providing full details of the playlist.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the playlist.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * Images for the playlist. The array may be empty or contain up to three images. The images are returned by size in descending order. See [Working with Playlists](/documentation/web-api/concepts/playlists). _**Note**: If returned, the source URL for the image (`url`) is temporary and will expire in less than a day._
   */
  "images": S.optionalWith(S.Array(ImageObject), { nullable: true }),
  /**
   * The name of the playlist.
   */
  "name": S.optionalWith(S.String, { nullable: true }),
  /**
   * The user who owns the playlist
   */
  "owner": S.optionalWith(PlaylistOwnerObject, { nullable: true }),
  /**
   * The playlist's public/private status (if it is added to the user's profile): `true` the playlist is public, `false` the playlist is private, `null` the playlist status is not relevant. For more about public/private status, see [Working with Playlists](/documentation/web-api/concepts/playlists)
   */
  "public": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * The version identifier for the current playlist. Can be supplied in other requests to target a specific playlist version
   */
  "snapshot_id": S.optionalWith(S.String, { nullable: true }),
  /**
   * The tracks of the playlist.
   */
  "tracks": S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), { nullable: true }),
  /**
   * The object type: "playlist"
   */
  "type": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the playlist.
   */
  "uri": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetPlaylist401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetPlaylist403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetPlaylist429 extends S.Struct({
  "error": ErrorObject
}) {}

export class ChangePlaylistDetailsParams extends S.Struct({}) {}

export class ChangePlaylistDetailsRequest
  extends S.Class<ChangePlaylistDetailsRequest>("ChangePlaylistDetailsRequest")({
    /**
     * The new name for the playlist, for example `"My New Playlist Title"`
     */
    "name": S.optionalWith(S.String, { nullable: true }),
    /**
     * The playlist's public/private status (if it should be added to the user's profile or not): `true` the playlist will be public, `false` the playlist will be private, `null` the playlist status is not relevant. For more about public/private status, see [Working with Playlists](/documentation/web-api/concepts/playlists)
     */
    "public": S.optionalWith(S.Boolean, { nullable: true }),
    /**
     * If `true`, the playlist will become collaborative and other users will be able to modify the playlist in their Spotify client. <br/>
     * _**Note**: You can only set `collaborative` to `true` on non-public playlists._
     */
    "collaborative": S.optionalWith(S.Boolean, { nullable: true }),
    /**
     * Value for playlist description as displayed in Spotify Clients and in the Web API.
     */
    "description": S.optionalWith(S.String, { nullable: true })
  })
{}

export class ChangePlaylistDetails401 extends S.Struct({
  "error": ErrorObject
}) {}

export class ChangePlaylistDetails403 extends S.Struct({
  "error": ErrorObject
}) {}

export class ChangePlaylistDetails429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetPlaylistsTracksParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * Filters for the query: a comma-separated list of the
   * fields to return. If omitted, all fields are returned. For example, to get
   * just the total number of items and the request limit:<br/>`fields=total,limit`<br/>A
   * dot separator can be used to specify non-reoccurring fields, while parentheses
   * can be used to specify reoccurring fields within objects. For example, to
   * get just the added date and user ID of the adder:<br/>`fields=items(added_at,added_by.id)`<br/>Use
   * multiple parentheses to drill down into nested objects, for example:<br/>`fields=items(track(name,href,album(name,href)))`<br/>Fields
   * can be excluded by prefixing them with an exclamation mark, for example:<br/>`fields=items.track.album(!external_urls,images)`
   */
  "fields": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const }),
  /**
   * A comma-separated list of item types that your client supports besides the default `track` type. Valid types are: `track` and `episode`.<br/>
   * _**Note**: This parameter was introduced to allow existing clients to maintain their current behaviour and might be deprecated in the future._<br/>
   * In addition to providing this parameter, make sure that your client properly handles cases of new types in the future by checking against the `type` field of each object.
   */
  "additional_types": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetPlaylistsTracks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetPlaylistsTracks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetPlaylistsTracks429 extends S.Struct({
  "error": ErrorObject
}) {}

export class ReorderOrReplacePlaylistsTracksParams extends S.Struct({
  /**
   * A comma-separated list of [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) to set, can be track or episode URIs. For example: `uris=spotify:track:4iV5W9uYEdYUVa79Axb7Rh,spotify:track:1301WleyT98MSxVHPZCA6M,spotify:episode:512ojhOuo1ktJprKbVcKyQ`<br/>A maximum of 100 items can be set in one request.
   */
  "uris": S.optionalWith(S.String, { nullable: true })
}) {}

export class ReorderOrReplacePlaylistsTracksRequest
  extends S.Class<ReorderOrReplacePlaylistsTracksRequest>("ReorderOrReplacePlaylistsTracksRequest")({
    "uris": S.optionalWith(S.Array(S.String), { nullable: true }),
    /**
     * The position of the first item to be reordered.
     */
    "range_start": S.optionalWith(S.Int, { nullable: true }),
    /**
     * The position where the items should be inserted.<br/>To reorder the items to the end of the playlist, simply set _insert_before_ to the position after the last item.<br/>Examples:<br/>To reorder the first item to the last position in a playlist with 10 items, set _range_start_ to 0, and _insert_before_ to 10.<br/>To reorder the last item in a playlist with 10 items to the start of the playlist, set _range_start_ to 9, and _insert_before_ to 0.
     */
    "insert_before": S.optionalWith(S.Int, { nullable: true }),
    /**
     * The amount of items to be reordered. Defaults to 1 if not set.<br/>The range of items to be reordered begins from the _range_start_ position, and includes the _range_length_ subsequent items.<br/>Example:<br/>To move the items at index 9-10 to the start of the playlist, _range_start_ is set to 9, and _range_length_ is set to 2.
     */
    "range_length": S.optionalWith(S.Int, { nullable: true }),
    /**
     * The playlist's snapshot ID against which you want to make the changes.
     */
    "snapshot_id": S.optionalWith(S.String, { nullable: true })
  })
{}

export class ReorderOrReplacePlaylistsTracks200 extends S.Struct({
  "snapshot_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class ReorderOrReplacePlaylistsTracks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class ReorderOrReplacePlaylistsTracks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class ReorderOrReplacePlaylistsTracks429 extends S.Struct({
  "error": ErrorObject
}) {}

export class AddTracksToPlaylistParams extends S.Struct({
  /**
   * The position to insert the items, a zero-based index. For example, to insert the items in the first position: `position=0`; to insert the items in the third position: `position=2`. If omitted, the items will be appended to the playlist. Items are added in the order they are listed in the query string or request body.
   */
  "position": S.optionalWith(S.Int, { nullable: true }),
  /**
   * A comma-separated list of [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) to add, can be track or episode URIs. For example:<br/>`uris=spotify:track:4iV5W9uYEdYUVa79Axb7Rh, spotify:track:1301WleyT98MSxVHPZCA6M, spotify:episode:512ojhOuo1ktJprKbVcKyQ`<br/>A maximum of 100 items can be added in one request. <br/>
   * _**Note**: it is likely that passing a large number of item URIs as a query parameter will exceed the maximum length of the request URI. When adding a large number of items, it is recommended to pass them in the request body, see below._
   */
  "uris": S.optionalWith(S.String, { nullable: true })
}) {}

export class AddTracksToPlaylistRequest extends S.Class<AddTracksToPlaylistRequest>("AddTracksToPlaylistRequest")({
  /**
   * A JSON array of the [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) to add. For example: `{"uris": ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh","spotify:track:1301WleyT98MSxVHPZCA6M", "spotify:episode:512ojhOuo1ktJprKbVcKyQ"]}`<br/>A maximum of 100 items can be added in one request. _**Note**: if the `uris` parameter is present in the query string, any URIs listed here in the body will be ignored._
   */
  "uris": S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * The position to insert the items, a zero-based index. For example, to insert the items in the first position: `position=0` ; to insert the items in the third position: `position=2`. If omitted, the items will be appended to the playlist. Items are added in the order they appear in the uris array. For example: `{"uris": ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh","spotify:track:1301WleyT98MSxVHPZCA6M"], "position": 3}`
   */
  "position": S.optionalWith(S.Int, { nullable: true })
}) {}

export class AddTracksToPlaylist201 extends S.Struct({
  "snapshot_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class AddTracksToPlaylist401 extends S.Struct({
  "error": ErrorObject
}) {}

export class AddTracksToPlaylist403 extends S.Struct({
  "error": ErrorObject
}) {}

export class AddTracksToPlaylist429 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveTracksPlaylistParams extends S.Struct({}) {}

export class RemoveTracksPlaylistRequest extends S.Class<RemoveTracksPlaylistRequest>("RemoveTracksPlaylistRequest")({
  /**
   * An array of objects containing [Spotify URIs](/documentation/web-api/concepts/spotify-uris-ids) of the tracks or episodes to remove.
   * For example: `{ "tracks": [{ "uri": "spotify:track:4iV5W9uYEdYUVa79Axb7Rh" },{ "uri": "spotify:track:1301WleyT98MSxVHPZCA6M" }] }`. A maximum of 100 objects can be sent at once.
   */
  "tracks": S.Array(S.Struct({
    /**
     * Spotify URI
     */
    "uri": S.optionalWith(S.String, { nullable: true })
  })),
  /**
   * The playlist's snapshot ID against which you want to make the changes.
   * The API will validate that the specified items exist and in the specified positions and make the changes,
   * even if more recent changes have been made to the playlist.
   */
  "snapshot_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class RemoveTracksPlaylist200 extends S.Struct({
  "snapshot_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class RemoveTracksPlaylist401 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveTracksPlaylist403 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveTracksPlaylist429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAListOfCurrentUsersPlaylistsParams extends S.Struct({
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * 'The index of the first playlist to return. Default:
   * 0 (the first object). Maximum offset: 100.000\. Use with `limit` to get the
   * next set of playlists.'
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class GetAListOfCurrentUsersPlaylists401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAListOfCurrentUsersPlaylists403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAListOfCurrentUsersPlaylists429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedAlbumsParams extends S.Struct({
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const }),
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

export class SavedAlbumObject extends S.Class<SavedAlbumObject>("SavedAlbumObject")({
  /**
   * The date and time the album was saved
   * Timestamps are returned in ISO 8601 format as Coordinated Universal Time (UTC) with a zero offset: YYYY-MM-DDTHH:MM:SSZ.
   * If the time is imprecise (for example, the date/time of an album release), an additional field indicates the precision; see for example, release_date in an album object.
   */
  "added_at": S.optionalWith(S.String, { nullable: true }),
  /**
   * Information about the album.
   */
  "album": S.optionalWith(AlbumObject, { nullable: true })
}) {}

export class PagingSavedAlbumObject extends S.Class<PagingSavedAlbumObject>("PagingSavedAlbumObject")({
  "items": S.Array(SavedAlbumObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class GetUsersSavedAlbums401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedAlbums403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedAlbums429 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveAlbumsUserParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the albums. Maximum: 20 IDs.
   */
  "ids": S.String
}) {}

export class SaveAlbumsUserRequest extends S.Class<SaveAlbumsUserRequest>("SaveAlbumsUserRequest")({
  /**
   * A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._
   */
  "ids": S.optionalWith(S.Array(S.String), { nullable: true })
}) {}

export class SaveAlbumsUser401 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveAlbumsUser403 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveAlbumsUser429 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveAlbumsUserParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the albums. Maximum: 20 IDs.
   */
  "ids": S.String
}) {}

export class RemoveAlbumsUserRequest extends S.Class<RemoveAlbumsUserRequest>("RemoveAlbumsUserRequest")({
  /**
   * A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._
   */
  "ids": S.optionalWith(S.Array(S.String), { nullable: true })
}) {}

export class RemoveAlbumsUser401 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveAlbumsUser403 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveAlbumsUser429 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedAlbumsParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the albums. Maximum: 20 IDs.
   */
  "ids": S.String
}) {}

export class CheckUsersSavedAlbums200 extends S.Array(S.Boolean) {}

export class CheckUsersSavedAlbums401 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedAlbums403 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedAlbums429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedTracksParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class SavedTrackObject extends S.Class<SavedTrackObject>("SavedTrackObject")({
  /**
   * The date and time the track was saved.
   * Timestamps are returned in ISO 8601 format as Coordinated Universal Time (UTC) with a zero offset: YYYY-MM-DDTHH:MM:SSZ.
   * If the time is imprecise (for example, the date/time of an album release), an additional field indicates the precision; see for example, release_date in an album object.
   */
  "added_at": S.optionalWith(S.String, { nullable: true }),
  /**
   * Information about the track.
   */
  "track": S.optionalWith(TrackObject, { nullable: true })
}) {}

export class PagingSavedTrackObject extends S.Class<PagingSavedTrackObject>("PagingSavedTrackObject")({
  "items": S.Array(SavedTrackObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class GetUsersSavedTracks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedTracks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedTracks429 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveTracksUserParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=4iV5W9uYEdYUVa79Axb7Rh,1301WleyT98MSxVHPZCA6M`. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class SaveTracksUserRequest extends S.Class<SaveTracksUserRequest>("SaveTracksUserRequest")({
  /**
   * A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._
   */
  "ids": S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * A JSON array of objects containing track IDs with their corresponding timestamps. Each object must include a track ID and an `added_at` timestamp. This allows you to specify when tracks were added to maintain a specific chronological order in the user's library.<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `timestamped_ids` is present in the body, any IDs listed in the query parameters or the `ids` field in the body will be ignored._
   */
  "timestamped_ids": S.optionalWith(
    S.Array(S.Struct({
      /**
       * The [Spotify ID](/documentation/web-api/concepts/spotify-uris-ids) for the track.
       */
      "id": S.String,
      /**
       * The timestamp when the track was added to the library. Use ISO 8601 format with UTC timezone (e.g., `2023-01-15T14:30:00Z`). You can specify past timestamps to insert tracks at specific positions in the library's chronological order. The API uses minute-level granularity for ordering, though the timestamp supports millisecond precision.
       */
      "added_at": S.String
    })),
    { nullable: true }
  )
}) {}

export class SaveTracksUser401 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveTracksUser403 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveTracksUser429 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveTracksUserParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=4iV5W9uYEdYUVa79Axb7Rh,1301WleyT98MSxVHPZCA6M`. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class RemoveTracksUserRequest extends S.Class<RemoveTracksUserRequest>("RemoveTracksUserRequest")({
  /**
   * A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `["4iV5W9uYEdYUVa79Axb7Rh", "1301WleyT98MSxVHPZCA6M"]`<br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._
   */
  "ids": S.optionalWith(S.Array(S.String), { nullable: true })
}) {}

export class RemoveTracksUser401 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveTracksUser403 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveTracksUser429 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedTracksParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=4iV5W9uYEdYUVa79Axb7Rh,1301WleyT98MSxVHPZCA6M`. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class CheckUsersSavedTracks200 extends S.Array(S.Boolean) {}

export class CheckUsersSavedTracks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedTracks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedTracks429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedEpisodesParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class SavedEpisodeObject extends S.Class<SavedEpisodeObject>("SavedEpisodeObject")({
  /**
   * The date and time the episode was saved.
   * Timestamps are returned in ISO 8601 format as Coordinated Universal Time (UTC) with a zero offset: YYYY-MM-DDTHH:MM:SSZ.
   */
  "added_at": S.optionalWith(S.String, { nullable: true }),
  /**
   * Information about the episode.
   */
  "episode": S.optionalWith(EpisodeObject, { nullable: true })
}) {}

export class PagingSavedEpisodeObject extends S.Class<PagingSavedEpisodeObject>("PagingSavedEpisodeObject")({
  "items": S.Array(SavedEpisodeObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class GetUsersSavedEpisodes401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedEpisodes403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedEpisodes429 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveEpisodesUserParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class SaveEpisodesUserRequest extends S.Class<SaveEpisodesUserRequest>("SaveEpisodesUserRequest")({
  /**
   * A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). <br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._
   */
  "ids": S.optionalWith(S.Array(S.String), { nullable: true })
}) {}

export class SaveEpisodesUser401 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveEpisodesUser403 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveEpisodesUser429 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveEpisodesUserParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=4iV5W9uYEdYUVa79Axb7Rh,1301WleyT98MSxVHPZCA6M`. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class RemoveEpisodesUserRequest extends S.Class<RemoveEpisodesUserRequest>("RemoveEpisodesUserRequest")({
  /**
   * A JSON array of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). <br/>A maximum of 50 items can be specified in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._
   */
  "ids": S.optionalWith(S.Array(S.String), { nullable: true })
}) {}

export class RemoveEpisodesUser401 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveEpisodesUser403 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveEpisodesUser429 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedEpisodesParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the episodes. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class CheckUsersSavedEpisodes200 extends S.Array(S.Boolean) {}

export class CheckUsersSavedEpisodes401 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedEpisodes403 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedEpisodes429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedShowsParams extends S.Struct({
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class SavedShowObject extends S.Class<SavedShowObject>("SavedShowObject")({
  /**
   * The date and time the show was saved.
   * Timestamps are returned in ISO 8601 format as Coordinated Universal Time (UTC) with a zero offset: YYYY-MM-DDTHH:MM:SSZ.
   * If the time is imprecise (for example, the date/time of an album release), an additional field indicates the precision; see for example, release_date in an album object.
   */
  "added_at": S.optionalWith(S.String, { nullable: true }),
  /**
   * Information about the show.
   */
  "show": S.optionalWith(SimplifiedShowObject, { nullable: true })
}) {}

export class PagingSavedShowObject extends S.Class<PagingSavedShowObject>("PagingSavedShowObject")({
  "items": S.Array(SavedShowObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class GetUsersSavedShows401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedShows403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersSavedShows429 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveShowsUserParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the shows. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class SaveShowsUser401 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveShowsUser403 extends S.Struct({
  "error": ErrorObject
}) {}

export class SaveShowsUser429 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveShowsUserParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the shows. Maximum: 50 IDs.
   */
  "ids": S.String,
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true })
}) {}

export class RemoveShowsUser401 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveShowsUser403 extends S.Struct({
  "error": ErrorObject
}) {}

export class RemoveShowsUser429 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedShowsParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for the shows. Maximum: 50 IDs.
   */
  "ids": S.String
}) {}

export class CheckUsersSavedShows200 extends S.Array(S.Boolean) {}

export class CheckUsersSavedShows401 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedShows403 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckUsersSavedShows429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersTopArtistsAndTracksParams extends S.Struct({
  /**
   * Over what time frame the affinities are computed. Valid values: `long_term` (calculated from ~1 year of data and including all new data as it becomes available), `medium_term` (approximately last 6 months), `short_term` (approximately last 4 weeks). Default: `medium_term`
   */
  "time_range": S.optionalWith(S.String, { nullable: true, default: () => "medium_term" as const }),
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class GetUsersTopArtistsAndTracks200 extends S.Record({ key: S.String, value: S.Unknown }) {}

export class GetUsersTopArtistsAndTracks401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersTopArtistsAndTracks403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersTopArtistsAndTracks429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersProfileParams extends S.Struct({}) {}

/**
 * The object type.
 */
export class PublicUserObjectType extends S.Literal("user") {}

export class PublicUserObject extends S.Class<PublicUserObject>("PublicUserObject")({
  /**
   * The name displayed on the user's profile. `null` if not available.
   */
  "display_name": S.optionalWith(S.String, { nullable: true }),
  /**
   * Known public external URLs for this user.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * Information about the followers of this user.
   */
  "followers": S.optionalWith(FollowersObject, { nullable: true }),
  /**
   * A link to the Web API endpoint for this user.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The [Spotify user ID](/documentation/web-api/concepts/spotify-uris-ids) for this user.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * The user's profile image.
   */
  "images": S.optionalWith(S.Array(ImageObject), { nullable: true }),
  /**
   * The object type.
   */
  "type": S.optionalWith(PublicUserObjectType, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for this user.
   */
  "uri": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetUsersProfile401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersProfile403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetUsersProfile429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetListUsersPlaylistsParams extends S.Struct({
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first playlist to return. Default:
   * 0 (the first object). Maximum offset: 100.000\. Use with `limit` to get the
   * next set of playlists.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class GetListUsersPlaylists401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetListUsersPlaylists403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetListUsersPlaylists429 extends S.Struct({
  "error": ErrorObject
}) {}

export class CreatePlaylistParams extends S.Struct({}) {}

export class CreatePlaylistRequest extends S.Class<CreatePlaylistRequest>("CreatePlaylistRequest")({
  /**
   * The name for the new playlist, for example `"Your Coolest Playlist"`. This name does not need to be unique; a user may have several playlists with the same name.
   */
  "name": S.String,
  /**
   * Defaults to `true`. The playlist's public/private status (if it should be added to the user's profile or not): `true` the playlist will be public, `false` the playlist will be private. To be able to create private playlists, the user must have granted the `playlist-modify-private` [scope](/documentation/web-api/concepts/scopes/#list-of-scopes). For more about public/private status, see [Working with Playlists](/documentation/web-api/concepts/playlists)
   */
  "public": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Defaults to `false`. If `true` the playlist will be collaborative. _**Note**: to create a collaborative playlist you must also set `public` to `false`. To create collaborative playlists you must have granted `playlist-modify-private` and `playlist-modify-public` [scopes](/documentation/web-api/concepts/scopes/#list-of-scopes)._
   */
  "collaborative": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * value for playlist description as displayed in Spotify Clients and in the Web API.
   */
  "description": S.optionalWith(S.String, { nullable: true })
}) {}

export class CreatePlaylist401 extends S.Struct({
  "error": ErrorObject
}) {}

export class CreatePlaylist403 extends S.Struct({
  "error": ErrorObject
}) {}

export class CreatePlaylist429 extends S.Struct({
  "error": ErrorObject
}) {}

export class FollowPlaylistParams extends S.Struct({}) {}

export class FollowPlaylistRequest extends S.Class<FollowPlaylistRequest>("FollowPlaylistRequest")({
  /**
   * Defaults to `true`. If `true` the playlist will be included in user's public playlists (added to profile), if `false` it will remain private. For more about public/private status, see [Working with Playlists](/documentation/web-api/concepts/playlists)
   */
  "public": S.optionalWith(S.Boolean, { nullable: true })
}) {}

export class FollowPlaylist401 extends S.Struct({
  "error": ErrorObject
}) {}

export class FollowPlaylist403 extends S.Struct({
  "error": ErrorObject
}) {}

export class FollowPlaylist429 extends S.Struct({
  "error": ErrorObject
}) {}

export class UnfollowPlaylistParams extends S.Struct({}) {}

export class UnfollowPlaylist401 extends S.Struct({
  "error": ErrorObject
}) {}

export class UnfollowPlaylist403 extends S.Struct({
  "error": ErrorObject
}) {}

export class UnfollowPlaylist429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetFeaturedPlaylistsParams extends S.Struct({
  /**
   * The desired language, consisting of an [ISO 639-1](http://en.wikipedia.org/wiki/ISO_639-1) language code and an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2), joined by an underscore. For example: `es_MX`, meaning &quot;Spanish (Mexico)&quot;. Provide this parameter if you want the category strings returned in a particular language.<br/> _**Note**: if `locale` is not supplied, or if the specified language is not available, the category strings returned will be in the Spotify default language (American English)._
   */
  "locale": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class PagingFeaturedPlaylistObject
  extends S.Class<PagingFeaturedPlaylistObject>("PagingFeaturedPlaylistObject")({
    /**
     * The localized message of a playlist.
     */
    "message": S.optionalWith(S.String, { nullable: true }),
    "playlists": S.optionalWith(PagingPlaylistObject, { nullable: true })
  })
{}

export class GetFeaturedPlaylists401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetFeaturedPlaylists403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetFeaturedPlaylists429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetCategoriesParams extends S.Struct({
  /**
   * The desired language, consisting of an [ISO 639-1](http://en.wikipedia.org/wiki/ISO_639-1) language code and an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2), joined by an underscore. For example: `es_MX`, meaning &quot;Spanish (Mexico)&quot;. Provide this parameter if you want the category strings returned in a particular language.<br/> _**Note**: if `locale` is not supplied, or if the specified language is not available, the category strings returned will be in the Spotify default language (American English)._
   */
  "locale": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class CategoryObject extends S.Class<CategoryObject>("CategoryObject")({
  /**
   * A link to the Web API endpoint returning full details of the category.
   */
  "href": S.String,
  /**
   * The category icon, in various sizes.
   */
  "icons": S.Array(ImageObject),
  /**
   * The [Spotify category ID](/documentation/web-api/concepts/spotify-uris-ids) of the category.
   */
  "id": S.String,
  /**
   * The name of the category.
   */
  "name": S.String
}) {}

export class GetCategories200Categories extends S.Struct({
  "items": S.Array(CategoryObject),
  /**
   * A link to the Web API endpoint returning the full result of the request
   */
  "href": S.String,
  /**
   * The maximum number of items in the response (as set in the query or by default).
   */
  "limit": S.Int,
  /**
   * URL to the next page of items. ( `null` if none)
   */
  "next": S.NullOr(S.String),
  /**
   * The offset of the items returned (as set in the query or by default)
   */
  "offset": S.Int,
  /**
   * URL to the previous page of items. ( `null` if none)
   */
  "previous": S.NullOr(S.String),
  /**
   * The total number of items available to return.
   */
  "total": S.Int
}) {}

export class GetCategories200 extends S.Struct({
  "categories": S.Record({ key: S.String, value: S.Unknown })
}) {}

export class GetCategories401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetCategories403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetCategories429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetACategoryParams extends S.Struct({
  /**
   * The desired language, consisting of an [ISO 639-1](http://en.wikipedia.org/wiki/ISO_639-1) language code and an [ISO 3166-1 alpha-2 country code](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2), joined by an underscore. For example: `es_MX`, meaning &quot;Spanish (Mexico)&quot;. Provide this parameter if you want the category strings returned in a particular language.<br/> _**Note**: if `locale` is not supplied, or if the specified language is not available, the category strings returned will be in the Spotify default language (American English)._
   */
  "locale": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetACategory401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetACategory403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetACategory429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetACategoriesPlaylistsParams extends S.Struct({
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class GetACategoriesPlaylists401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetACategoriesPlaylists403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetACategoriesPlaylists429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetPlaylistCoverParams extends S.Struct({}) {}

export class GetPlaylistCover200 extends S.Array(ImageObject) {}

export class GetPlaylistCover401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetPlaylistCover403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetPlaylistCover429 extends S.Struct({
  "error": ErrorObject
}) {}

export class UploadCustomPlaylistCoverParams extends S.Struct({}) {}

export class UploadCustomPlaylistCover401 extends S.Struct({
  "error": ErrorObject
}) {}

export class UploadCustomPlaylistCover403 extends S.Struct({
  "error": ErrorObject
}) {}

export class UploadCustomPlaylistCover429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetNewReleasesParams extends S.Struct({
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.
   */
  "offset": S.optionalWith(S.Int, { nullable: true, default: () => 0 as const })
}) {}

export class GetNewReleases200 extends S.Struct({
  "albums": PagingSimplifiedAlbumObject
}) {}

export class GetNewReleases401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetNewReleases403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetNewReleases429 extends S.Struct({
  "error": ErrorObject
}) {}

/**
 * The ID type: currently only `artist` is supported.
 */
export class GetFollowedParamsType extends S.Literal("artist") {}

export class GetFollowedParams extends S.Struct({
  /**
   * The ID type: currently only `artist` is supported.
   */
  "type": GetFollowedParamsType,
  /**
   * The last artist ID retrieved from the previous request.
   */
  "after": S.optionalWith(S.String, { nullable: true }),
  /**
   * The maximum number of items to return. Default: 20\. Minimum: 1\. Maximum: 50\.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  })
}) {}

export class CursorObject extends S.Class<CursorObject>("CursorObject")({
  /**
   * The cursor to use as key to find the next page of items.
   */
  "after": S.optionalWith(S.String, { nullable: true }),
  /**
   * The cursor to use as key to find the previous page of items.
   */
  "before": S.optionalWith(S.String, { nullable: true })
}) {}

export class CursorPagingSimplifiedArtistObject
  extends S.Class<CursorPagingSimplifiedArtistObject>("CursorPagingSimplifiedArtistObject")({
    "items": S.optionalWith(S.Array(ArtistObject), { nullable: true }),
    /**
     * A link to the Web API endpoint returning the full result of the request.
     */
    "href": S.optionalWith(S.String, { nullable: true }),
    /**
     * The maximum number of items in the response (as set in the query or by default).
     */
    "limit": S.optionalWith(S.Int, { nullable: true }),
    /**
     * URL to the next page of items. ( `null` if none)
     */
    "next": S.optionalWith(S.String, { nullable: true }),
    /**
     * The cursors used to find the next set of items.
     */
    "cursors": S.optionalWith(CursorObject, { nullable: true }),
    /**
     * The total number of items available to return.
     */
    "total": S.optionalWith(S.Int, { nullable: true })
  })
{}

export class GetFollowed200 extends S.Struct({
  "artists": CursorPagingSimplifiedArtistObject
}) {}

export class GetFollowed401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetFollowed403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetFollowed429 extends S.Struct({
  "error": ErrorObject
}) {}

/**
 * The ID type.
 */
export class FollowArtistsUsersParamsType extends S.Literal("artist", "user") {}

export class FollowArtistsUsersParams extends S.Struct({
  /**
   * The ID type.
   */
  "type": FollowArtistsUsersParamsType,
  /**
   * A comma-separated list of the artist or the user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids).
   * A maximum of 50 IDs can be sent in one request.
   */
  "ids": S.String
}) {}

export class FollowArtistsUsersRequest extends S.Class<FollowArtistsUsersRequest>("FollowArtistsUsersRequest")({
  /**
   * A JSON array of the artist or user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids).
   * For example: `{ids:["74ASZWbe4lXaubB36ztrGX", "08td7MxkoHQkXnWAYD8d6Q"]}`. A maximum of 50 IDs can be sent in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._
   */
  "ids": S.Array(S.String)
}) {}

export class FollowArtistsUsers401 extends S.Struct({
  "error": ErrorObject
}) {}

export class FollowArtistsUsers403 extends S.Struct({
  "error": ErrorObject
}) {}

export class FollowArtistsUsers429 extends S.Struct({
  "error": ErrorObject
}) {}

/**
 * The ID type: either `artist` or `user`.
 */
export class UnfollowArtistsUsersParamsType extends S.Literal("artist", "user") {}

export class UnfollowArtistsUsersParams extends S.Struct({
  /**
   * The ID type: either `artist` or `user`.
   */
  "type": UnfollowArtistsUsersParamsType,
  /**
   * A comma-separated list of the artist or the user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `ids=74ASZWbe4lXaubB36ztrGX,08td7MxkoHQkXnWAYD8d6Q`. A maximum of 50 IDs can be sent in one request.
   */
  "ids": S.String
}) {}

export class UnfollowArtistsUsersRequest extends S.Class<UnfollowArtistsUsersRequest>("UnfollowArtistsUsersRequest")({
  /**
   * A JSON array of the artist or user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids). For example: `{ids:["74ASZWbe4lXaubB36ztrGX", "08td7MxkoHQkXnWAYD8d6Q"]}`. A maximum of 50 IDs can be sent in one request. _**Note**: if the `ids` parameter is present in the query string, any IDs listed here in the body will be ignored._
   */
  "ids": S.optionalWith(S.Array(S.String), { nullable: true })
}) {}

export class UnfollowArtistsUsers401 extends S.Struct({
  "error": ErrorObject
}) {}

export class UnfollowArtistsUsers403 extends S.Struct({
  "error": ErrorObject
}) {}

export class UnfollowArtistsUsers429 extends S.Struct({
  "error": ErrorObject
}) {}

/**
 * The ID type: either `artist` or `user`.
 */
export class CheckCurrentUserFollowsParamsType extends S.Literal("artist", "user") {}

export class CheckCurrentUserFollowsParams extends S.Struct({
  /**
   * The ID type: either `artist` or `user`.
   */
  "type": CheckCurrentUserFollowsParamsType,
  /**
   * A comma-separated list of the artist or the user [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) to check. For example: `ids=74ASZWbe4lXaubB36ztrGX,08td7MxkoHQkXnWAYD8d6Q`. A maximum of 50 IDs can be sent in one request.
   */
  "ids": S.String
}) {}

export class CheckCurrentUserFollows200 extends S.Array(S.Boolean) {}

export class CheckCurrentUserFollows401 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckCurrentUserFollows403 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckCurrentUserFollows429 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckIfUserFollowsPlaylistParams extends S.Struct({
  /**
   * **Deprecated** A single item list containing current user's [Spotify Username](/documentation/web-api/concepts/spotify-uris-ids). Maximum: 1 id.
   */
  "ids": S.optionalWith(S.String, { nullable: true })
}) {}

export class CheckIfUserFollowsPlaylist200 extends S.Array(S.Boolean) {}

export class CheckIfUserFollowsPlaylist401 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckIfUserFollowsPlaylist403 extends S.Struct({
  "error": ErrorObject
}) {}

export class CheckIfUserFollowsPlaylist429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetSeveralAudioFeaturesParams extends S.Struct({
  /**
   * A comma-separated list of the [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids)
   * for the tracks. Maximum: 100 IDs.
   */
  "ids": S.String
}) {}

/**
 * The key the track is in. Integers map to pitches using standard [Pitch Class notation](https://en.wikipedia.org/wiki/Pitch_class). E.g. 0 = C, 1 = C♯/D♭, 2 = D, and so on. If no key was detected, the value is -1.
 */
export class Key extends S.Int.pipe(S.greaterThanOrEqualTo(-1), S.lessThanOrEqualTo(11)) {}

/**
 * The overall loudness of a track in decibels (dB). Loudness values are averaged across the entire track and are useful for comparing relative loudness of tracks. Loudness is the quality of a sound that is the primary psychological correlate of physical strength (amplitude). Values typically range between -60 and 0 db.
 */
export class Loudness extends S.Number {}

/**
 * Mode indicates the modality (major or minor) of a track, the type of scale from which its melodic content is derived. Major is represented by 1 and minor is 0.
 */
export class Mode extends S.Int {}

/**
 * The overall estimated tempo of a track in beats per minute (BPM). In musical terminology, tempo is the speed or pace of a given piece and derives directly from the average beat duration.
 */
export class Tempo extends S.Number {}

/**
 * An estimated time signature. The time signature (meter) is a notational convention to specify how many beats are in each bar (or measure). The time signature ranges from 3 to 7 indicating time signatures of "3/4", to "7/4".
 */
export class TimeSignature extends S.Int.pipe(S.greaterThanOrEqualTo(3), S.lessThanOrEqualTo(7)) {}

/**
 * The object type.
 */
export class AudioFeaturesObjectType extends S.Literal("audio_features") {}

export class AudioFeaturesObject extends S.Class<AudioFeaturesObject>("AudioFeaturesObject")({
  /**
   * A confidence measure from 0.0 to 1.0 of whether the track is acoustic. 1.0 represents high confidence the track is acoustic.
   */
  "acousticness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * A URL to access the full audio analysis of this track. An access token is required to access this data.
   */
  "analysis_url": S.optionalWith(S.String, { nullable: true }),
  /**
   * Danceability describes how suitable a track is for dancing based on a combination of musical elements including tempo, rhythm stability, beat strength, and overall regularity. A value of 0.0 is least danceable and 1.0 is most danceable.
   */
  "danceability": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The duration of the track in milliseconds.
   */
  "duration_ms": S.optionalWith(S.Int, { nullable: true }),
  /**
   * Energy is a measure from 0.0 to 1.0 and represents a perceptual measure of intensity and activity. Typically, energetic tracks feel fast, loud, and noisy. For example, death metal has high energy, while a Bach prelude scores low on the scale. Perceptual features contributing to this attribute include dynamic range, perceived loudness, timbre, onset rate, and general entropy.
   */
  "energy": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The Spotify ID for the track.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * Predicts whether a track contains no vocals. "Ooh" and "aah" sounds are treated as instrumental in this context. Rap or spoken word tracks are clearly "vocal". The closer the instrumentalness value is to 1.0, the greater likelihood the track contains no vocal content. Values above 0.5 are intended to represent instrumental tracks, but confidence is higher as the value approaches 1.0.
   */
  "instrumentalness": S.optionalWith(S.Number, { nullable: true }),
  "key": S.optionalWith(Key, { nullable: true }),
  /**
   * Detects the presence of an audience in the recording. Higher liveness values represent an increased probability that the track was performed live. A value above 0.8 provides strong likelihood that the track is live.
   */
  "liveness": S.optionalWith(S.Number, { nullable: true }),
  "loudness": S.optionalWith(Loudness, { nullable: true }),
  "mode": S.optionalWith(Mode, { nullable: true }),
  /**
   * Speechiness detects the presence of spoken words in a track. The more exclusively speech-like the recording (e.g. talk show, audio book, poetry), the closer to 1.0 the attribute value. Values above 0.66 describe tracks that are probably made entirely of spoken words. Values between 0.33 and 0.66 describe tracks that may contain both music and speech, either in sections or layered, including such cases as rap music. Values below 0.33 most likely represent music and other non-speech-like tracks.
   */
  "speechiness": S.optionalWith(S.Number, { nullable: true }),
  "tempo": S.optionalWith(Tempo, { nullable: true }),
  "time_signature": S.optionalWith(TimeSignature, { nullable: true }),
  /**
   * A link to the Web API endpoint providing full details of the track.
   */
  "track_href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The object type.
   */
  "type": S.optionalWith(AudioFeaturesObjectType, { nullable: true }),
  /**
   * The Spotify URI for the track.
   */
  "uri": S.optionalWith(S.String, { nullable: true }),
  /**
   * A measure from 0.0 to 1.0 describing the musical positiveness conveyed by a track. Tracks with high valence sound more positive (e.g. happy, cheerful, euphoric), while tracks with low valence sound more negative (e.g. sad, depressed, angry).
   */
  "valence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true })
}) {}

export class GetSeveralAudioFeatures200 extends S.Struct({
  "audio_features": S.Array(AudioFeaturesObject)
}) {}

export class GetSeveralAudioFeatures401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetSeveralAudioFeatures403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetSeveralAudioFeatures429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAudioFeatures401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAudioFeatures403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAudioFeatures429 extends S.Struct({
  "error": ErrorObject
}) {}

export class TimeIntervalObject extends S.Class<TimeIntervalObject>("TimeIntervalObject")({
  /**
   * The starting point (in seconds) of the time interval.
   */
  "start": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The duration (in seconds) of the time interval.
   */
  "duration": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The confidence, from 0.0 to 1.0, of the reliability of the interval.
   */
  "confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true })
}) {}

/**
 * Indicates the modality (major or minor) of a section, the type of scale from which its melodic content is derived. This field will contain a 0 for "minor", a 1 for "major", or a -1 for no result. Note that the major key (e.g. C major) could more likely be confused with the minor key at 3 semitones lower (e.g. A minor) as both keys carry the same pitches.
 */
export class SectionObjectMode extends S.Literal(-1, 0, 1) {}

export class SectionObject extends S.Class<SectionObject>("SectionObject")({
  /**
   * The starting point (in seconds) of the section.
   */
  "start": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The duration (in seconds) of the section.
   */
  "duration": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The confidence, from 0.0 to 1.0, of the reliability of the section's "designation".
   */
  "confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * The overall loudness of the section in decibels (dB). Loudness values are useful for comparing relative loudness of sections within tracks.
   */
  "loudness": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The overall estimated tempo of the section in beats per minute (BPM). In musical terminology, tempo is the speed or pace of a given piece and derives directly from the average beat duration.
   */
  "tempo": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The confidence, from 0.0 to 1.0, of the reliability of the tempo. Some tracks contain tempo changes or sounds which don't contain tempo (like pure speech) which would correspond to a low value in this field.
   */
  "tempo_confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * The estimated overall key of the section. The values in this field ranging from 0 to 11 mapping to pitches using standard Pitch Class notation (E.g. 0 = C, 1 = C♯/D♭, 2 = D, and so on). If no key was detected, the value is -1.
   */
  "key": S.optionalWith(S.Int, { nullable: true }),
  /**
   * The confidence, from 0.0 to 1.0, of the reliability of the key. Songs with many key changes may correspond to low values in this field.
   */
  "key_confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * Indicates the modality (major or minor) of a section, the type of scale from which its melodic content is derived. This field will contain a 0 for "minor", a 1 for "major", or a -1 for no result. Note that the major key (e.g. C major) could more likely be confused with the minor key at 3 semitones lower (e.g. A minor) as both keys carry the same pitches.
   */
  "mode": S.optionalWith(SectionObjectMode, { nullable: true }),
  /**
   * The confidence, from 0.0 to 1.0, of the reliability of the `mode`.
   */
  "mode_confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  "time_signature": S.optionalWith(TimeSignature, { nullable: true }),
  /**
   * The confidence, from 0.0 to 1.0, of the reliability of the `time_signature`. Sections with time signature changes may correspond to low values in this field.
   */
  "time_signature_confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  })
}) {}

export class SegmentObject extends S.Class<SegmentObject>("SegmentObject")({
  /**
   * The starting point (in seconds) of the segment.
   */
  "start": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The duration (in seconds) of the segment.
   */
  "duration": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The confidence, from 0.0 to 1.0, of the reliability of the segmentation. Segments of the song which are difficult to logically segment (e.g: noise) may correspond to low values in this field.
   */
  "confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * The onset loudness of the segment in decibels (dB). Combined with `loudness_max` and `loudness_max_time`, these components can be used to describe the "attack" of the segment.
   */
  "loudness_start": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The peak loudness of the segment in decibels (dB). Combined with `loudness_start` and `loudness_max_time`, these components can be used to describe the "attack" of the segment.
   */
  "loudness_max": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The segment-relative offset of the segment peak loudness in seconds. Combined with `loudness_start` and `loudness_max`, these components can be used to desctibe the "attack" of the segment.
   */
  "loudness_max_time": S.optionalWith(S.Number, { nullable: true }),
  /**
   * The offset loudness of the segment in decibels (dB). This value should be equivalent to the loudness_start of the following segment.
   */
  "loudness_end": S.optionalWith(S.Number, { nullable: true }),
  /**
   * Pitch content is given by a “chroma” vector, corresponding to the 12 pitch classes C, C#, D to B, with values ranging from 0 to 1 that describe the relative dominance of every pitch in the chromatic scale. For example a C Major chord would likely be represented by large values of C, E and G (i.e. classes 0, 4, and 7).
   *
   * Vectors are normalized to 1 by their strongest dimension, therefore noisy sounds are likely represented by values that are all close to 1, while pure tones are described by one value at 1 (the pitch) and others near 0.
   * As can be seen below, the 12 vector indices are a combination of low-power spectrum values at their respective pitch frequencies.
   * ![pitch vector](/assets/audio/Pitch_vector.png)
   */
  "pitches": S.optionalWith(S.Array(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1))), {
    nullable: true
  }),
  /**
   * Timbre is the quality of a musical note or sound that distinguishes different types of musical instruments, or voices. It is a complex notion also referred to as sound color, texture, or tone quality, and is derived from the shape of a segment’s spectro-temporal surface, independently of pitch and loudness. The timbre feature is a vector that includes 12 unbounded values roughly centered around 0. Those values are high level abstractions of the spectral surface, ordered by degree of importance.
   *
   * For completeness however, the first dimension represents the average loudness of the segment; second emphasizes brightness; third is more closely correlated to the flatness of a sound; fourth to sounds with a stronger attack; etc. See an image below representing the 12 basis functions (i.e. template segments).
   * ![timbre basis functions](/assets/audio/Timbre_basis_functions.png)
   *
   * The actual timbre of the segment is best described as a linear combination of these 12 basis functions weighted by the coefficient values: timbre = c1 x b1 + c2 x b2 + ... + c12 x b12, where c1 to c12 represent the 12 coefficients and b1 to b12 the 12 basis functions as displayed below. Timbre vectors are best used in comparison with each other.
   */
  "timbre": S.optionalWith(S.Array(S.Number), { nullable: true })
}) {}

export class AudioAnalysisObject extends S.Class<AudioAnalysisObject>("AudioAnalysisObject")({
  "meta": S.optionalWith(
    S.Struct({
      /**
       * The version of the Analyzer used to analyze this track.
       */
      "analyzer_version": S.optionalWith(S.String, { nullable: true }),
      /**
       * The platform used to read the track's audio data.
       */
      "platform": S.optionalWith(S.String, { nullable: true }),
      /**
       * A detailed status code for this track. If analysis data is missing, this code may explain why.
       */
      "detailed_status": S.optionalWith(S.String, { nullable: true }),
      /**
       * The return code of the analyzer process. 0 if successful, 1 if any errors occurred.
       */
      "status_code": S.optionalWith(S.Int, { nullable: true }),
      /**
       * The Unix timestamp (in seconds) at which this track was analyzed.
       */
      "timestamp": S.optionalWith(S.Int, { nullable: true }),
      /**
       * The amount of time taken to analyze this track.
       */
      "analysis_time": S.optionalWith(S.Number, { nullable: true }),
      /**
       * The method used to read the track's audio data.
       */
      "input_process": S.optionalWith(S.String, { nullable: true })
    }),
    { nullable: true }
  ),
  "track": S.optionalWith(
    S.Struct({
      /**
       * The exact number of audio samples analyzed from this track. See also `analysis_sample_rate`.
       */
      "num_samples": S.optionalWith(S.Int, { nullable: true }),
      /**
       * Length of the track in seconds.
       */
      "duration": S.optionalWith(S.Number, { nullable: true }),
      /**
       * This field will always contain the empty string.
       */
      "sample_md5": S.optionalWith(S.String, { nullable: true }),
      /**
       * An offset to the start of the region of the track that was analyzed. (As the entire track is analyzed, this should always be 0.)
       */
      "offset_seconds": S.optionalWith(S.Int, { nullable: true }),
      /**
       * The length of the region of the track was analyzed, if a subset of the track was analyzed. (As the entire track is analyzed, this should always be 0.)
       */
      "window_seconds": S.optionalWith(S.Int, { nullable: true }),
      /**
       * The sample rate used to decode and analyze this track. May differ from the actual sample rate of this track available on Spotify.
       */
      "analysis_sample_rate": S.optionalWith(S.Int, { nullable: true }),
      /**
       * The number of channels used for analysis. If 1, all channels are summed together to mono before analysis.
       */
      "analysis_channels": S.optionalWith(S.Int, { nullable: true }),
      /**
       * The time, in seconds, at which the track's fade-in period ends. If the track has no fade-in, this will be 0.0.
       */
      "end_of_fade_in": S.optionalWith(S.Number, { nullable: true }),
      /**
       * The time, in seconds, at which the track's fade-out period starts. If the track has no fade-out, this should match the track's length.
       */
      "start_of_fade_out": S.optionalWith(S.Number, { nullable: true }),
      "loudness": S.optionalWith(Loudness, { nullable: true }),
      "tempo": S.optionalWith(Tempo, { nullable: true }),
      /**
       * The confidence, from 0.0 to 1.0, of the reliability of the `tempo`.
       */
      "tempo_confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
        nullable: true
      }),
      "time_signature": S.optionalWith(TimeSignature, { nullable: true }),
      /**
       * The confidence, from 0.0 to 1.0, of the reliability of the `time_signature`.
       */
      "time_signature_confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
        nullable: true
      }),
      "key": S.optionalWith(Key, { nullable: true }),
      /**
       * The confidence, from 0.0 to 1.0, of the reliability of the `key`.
       */
      "key_confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
        nullable: true
      }),
      "mode": S.optionalWith(Mode, { nullable: true }),
      /**
       * The confidence, from 0.0 to 1.0, of the reliability of the `mode`.
       */
      "mode_confidence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
        nullable: true
      }),
      /**
       * An [Echo Nest Musical Fingerprint (ENMFP)](https://academiccommons.columbia.edu/doi/10.7916/D8Q248M4) codestring for this track.
       */
      "codestring": S.optionalWith(S.String, { nullable: true }),
      /**
       * A version number for the Echo Nest Musical Fingerprint format used in the codestring field.
       */
      "code_version": S.optionalWith(S.Number, { nullable: true }),
      /**
       * An [EchoPrint](https://github.com/spotify/echoprint-codegen) codestring for this track.
       */
      "echoprintstring": S.optionalWith(S.String, { nullable: true }),
      /**
       * A version number for the EchoPrint format used in the echoprintstring field.
       */
      "echoprint_version": S.optionalWith(S.Number, { nullable: true }),
      /**
       * A [Synchstring](https://github.com/echonest/synchdata) for this track.
       */
      "synchstring": S.optionalWith(S.String, { nullable: true }),
      /**
       * A version number for the Synchstring used in the synchstring field.
       */
      "synch_version": S.optionalWith(S.Number, { nullable: true }),
      /**
       * A Rhythmstring for this track. The format of this string is similar to the Synchstring.
       */
      "rhythmstring": S.optionalWith(S.String, { nullable: true }),
      /**
       * A version number for the Rhythmstring used in the rhythmstring field.
       */
      "rhythm_version": S.optionalWith(S.Number, { nullable: true })
    }),
    { nullable: true }
  ),
  /**
   * The time intervals of the bars throughout the track. A bar (or measure) is a segment of time defined as a given number of beats.
   */
  "bars": S.optionalWith(S.Array(TimeIntervalObject), { nullable: true }),
  /**
   * The time intervals of beats throughout the track. A beat is the basic time unit of a piece of music; for example, each tick of a metronome. Beats are typically multiples of tatums.
   */
  "beats": S.optionalWith(S.Array(TimeIntervalObject), { nullable: true }),
  /**
   * Sections are defined by large variations in rhythm or timbre, e.g. chorus, verse, bridge, guitar solo, etc. Each section contains its own descriptions of tempo, key, mode, time_signature, and loudness.
   */
  "sections": S.optionalWith(S.Array(SectionObject), { nullable: true }),
  /**
   * Each segment contains a roughly conisistent sound throughout its duration.
   */
  "segments": S.optionalWith(S.Array(SegmentObject), { nullable: true }),
  /**
   * A tatum represents the lowest regular pulse train that a listener intuitively infers from the timing of perceived musical events (segments).
   */
  "tatums": S.optionalWith(S.Array(TimeIntervalObject), { nullable: true })
}) {}

export class GetAudioAnalysis401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAudioAnalysis403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAudioAnalysis429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetRecommendationsParams extends S.Struct({
  /**
   * The target size of the list of recommended tracks. For seeds with unusually small pools or when highly restrictive filtering is applied, it may be impossible to generate the requested number of recommended tracks. Debugging information for such cases is available in the response. Default: 20\. Minimum: 1\. Maximum: 100.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(1), S.lessThanOrEqualTo(100)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * A comma separated list of [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for seed artists.  Up to 5 seed values may be provided in any combination of `seed_artists`, `seed_tracks` and `seed_genres`.<br/> _**Note**: only required if `seed_genres` and `seed_tracks` are not set_.
   */
  "seed_artists": S.String,
  /**
   * A comma separated list of any genres in the set of [available genre seeds](/documentation/web-api/reference/get-recommendation-genres). Up to 5 seed values may be provided in any combination of `seed_artists`, `seed_tracks` and `seed_genres`.<br/> _**Note**: only required if `seed_artists` and `seed_tracks` are not set_.
   */
  "seed_genres": S.String,
  /**
   * A comma separated list of [Spotify IDs](/documentation/web-api/concepts/spotify-uris-ids) for a seed track.  Up to 5 seed values may be provided in any combination of `seed_artists`, `seed_tracks` and `seed_genres`.<br/> _**Note**: only required if `seed_artists` and `seed_genres` are not set_.
   */
  "seed_tracks": S.String,
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_acousticness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_acousticness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_acousticness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_danceability": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_danceability": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_danceability": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_duration_ms": S.optionalWith(S.Int, { nullable: true }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_duration_ms": S.optionalWith(S.Int, { nullable: true }),
  /**
   * Target duration of the track (ms)
   */
  "target_duration_ms": S.optionalWith(S.Int, { nullable: true }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_energy": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_energy": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_energy": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_instrumentalness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_instrumentalness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_instrumentalness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_key": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(11)), { nullable: true }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_key": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(11)), { nullable: true }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_key": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(11)), { nullable: true }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_liveness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_liveness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_liveness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_loudness": S.optionalWith(S.Number, { nullable: true }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_loudness": S.optionalWith(S.Number, { nullable: true }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_loudness": S.optionalWith(S.Number, { nullable: true }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_mode": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_mode": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_mode": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_popularity": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(100)), { nullable: true }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_popularity": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(100)), { nullable: true }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_popularity": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(100)), {
    nullable: true
  }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_speechiness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_speechiness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_speechiness": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), {
    nullable: true
  }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_tempo": S.optionalWith(S.Number, { nullable: true }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_tempo": S.optionalWith(S.Number, { nullable: true }),
  /**
   * Target tempo (BPM)
   */
  "target_tempo": S.optionalWith(S.Number, { nullable: true }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_time_signature": S.optionalWith(S.Int.pipe(S.lessThanOrEqualTo(11)), { nullable: true }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_time_signature": S.optionalWith(S.Int, { nullable: true }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_time_signature": S.optionalWith(S.Int, { nullable: true }),
  /**
   * For each tunable track attribute, a hard floor on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `min_tempo=140` would restrict results to only those tracks with a tempo of greater than 140 beats per minute.
   */
  "min_valence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * For each tunable track attribute, a hard ceiling on the selected track attribute’s value can be provided. See tunable track attributes below for the list of available options. For example, `max_instrumentalness=0.35` would filter out most tracks that are likely to be instrumental.
   */
  "max_valence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true }),
  /**
   * For each of the tunable track attributes (below) a target value may be provided. Tracks with the attribute values nearest to the target values will be preferred. For example, you might request `target_energy=0.6` and `target_danceability=0.8`. All target values will be weighed equally in ranking results.
   */
  "target_valence": S.optionalWith(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)), { nullable: true })
}) {}

export class RecommendationSeedObject extends S.Class<RecommendationSeedObject>("RecommendationSeedObject")({
  /**
   * The number of tracks available after min\_\* and max\_\* filters have been applied.
   */
  "afterFilteringSize": S.optionalWith(S.Int, { nullable: true }),
  /**
   * The number of tracks available after relinking for regional availability.
   */
  "afterRelinkingSize": S.optionalWith(S.Int, { nullable: true }),
  /**
   * A link to the full track or artist data for this seed. For tracks this will be a link to a Track Object. For artists a link to an Artist Object. For genre seeds, this value will be `null`.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * The id used to select this seed. This will be the same as the string used in the `seed_artists`, `seed_tracks` or `seed_genres` parameter.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * The number of recommended tracks available for this seed.
   */
  "initialPoolSize": S.optionalWith(S.Int, { nullable: true }),
  /**
   * The entity type of this seed. One of `artist`, `track` or `genre`.
   */
  "type": S.optionalWith(S.String, { nullable: true })
}) {}

export class RecommendationsObject extends S.Class<RecommendationsObject>("RecommendationsObject")({
  /**
   * An array of recommendation seed objects.
   */
  "seeds": S.Array(RecommendationSeedObject),
  /**
   * An array of track object (simplified) ordered according to the parameters supplied.
   */
  "tracks": S.Array(TrackObject)
}) {}

export class GetRecommendations401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetRecommendations403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetRecommendations429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetRecommendationGenres200 extends S.Struct({
  "genres": S.Array(S.String)
}) {}

export class GetRecommendationGenres401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetRecommendationGenres403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetRecommendationGenres429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetInformationAboutTheUsersCurrentPlaybackParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * A comma-separated list of item types that your client supports besides the default `track` type. Valid types are: `track` and `episode`.<br/>
   * _**Note**: This parameter was introduced to allow existing clients to maintain their current behaviour and might be deprecated in the future._<br/>
   * In addition to providing this parameter, make sure that your client properly handles cases of new types in the future by checking against the `type` field of each object.
   */
  "additional_types": S.optionalWith(S.String, { nullable: true })
}) {}

export class DeviceObject extends S.Class<DeviceObject>("DeviceObject")({
  /**
   * The device ID. This ID is unique and persistent to some extent. However, this is not guaranteed and any cached `device_id` should periodically be cleared out and refetched as necessary.
   */
  "id": S.optionalWith(S.String, { nullable: true }),
  /**
   * If this device is the currently active device.
   */
  "is_active": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * If this device is currently in a private session.
   */
  "is_private_session": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Whether controlling this device is restricted. At present if this is "true" then no Web API commands will be accepted by this device.
   */
  "is_restricted": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * A human-readable name for the device. Some devices have a name that the user can configure (e.g. \"Loudest speaker\") and some devices have a generic name associated with the manufacturer or device model.
   */
  "name": S.optionalWith(S.String, { nullable: true }),
  /**
   * Device type, such as "computer", "smartphone" or "speaker".
   */
  "type": S.optionalWith(S.String, { nullable: true }),
  /**
   * The current volume in percent.
   */
  "volume_percent": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(100)), { nullable: true }),
  /**
   * If this device can be used to set the volume.
   */
  "supports_volume": S.optionalWith(S.Boolean, { nullable: true })
}) {}

export class ContextObject extends S.Class<ContextObject>("ContextObject")({
  /**
   * The object type, e.g. "artist", "playlist", "album", "show".
   */
  "type": S.optionalWith(S.String, { nullable: true }),
  /**
   * A link to the Web API endpoint providing full details of the track.
   */
  "href": S.optionalWith(S.String, { nullable: true }),
  /**
   * External URLs for this context.
   */
  "external_urls": S.optionalWith(ExternalUrlObject, { nullable: true }),
  /**
   * The [Spotify URI](/documentation/web-api/concepts/spotify-uris-ids) for the context.
   */
  "uri": S.optionalWith(S.String, { nullable: true })
}) {}

export class DisallowsObject extends S.Class<DisallowsObject>("DisallowsObject")({
  /**
   * Interrupting playback. Optional field.
   */
  "interrupting_playback": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Pausing. Optional field.
   */
  "pausing": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Resuming. Optional field.
   */
  "resuming": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Seeking playback location. Optional field.
   */
  "seeking": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Skipping to the next context. Optional field.
   */
  "skipping_next": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Skipping to the previous context. Optional field.
   */
  "skipping_prev": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Toggling repeat context flag. Optional field.
   */
  "toggling_repeat_context": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Toggling shuffle flag. Optional field.
   */
  "toggling_shuffle": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Toggling repeat track flag. Optional field.
   */
  "toggling_repeat_track": S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Transfering playback between devices. Optional field.
   */
  "transferring_playback": S.optionalWith(S.Boolean, { nullable: true })
}) {}

export class CurrentlyPlayingContextObject
  extends S.Class<CurrentlyPlayingContextObject>("CurrentlyPlayingContextObject")({
    /**
     * The device that is currently active.
     */
    "device": S.optionalWith(DeviceObject, { nullable: true }),
    /**
     * off, track, context
     */
    "repeat_state": S.optionalWith(S.String, { nullable: true }),
    /**
     * If shuffle is on or off.
     */
    "shuffle_state": S.optionalWith(S.Boolean, { nullable: true }),
    /**
     * A Context Object. Can be `null`.
     */
    "context": S.optionalWith(ContextObject, { nullable: true }),
    /**
     * Unix Millisecond Timestamp when playback state was last changed (play, pause, skip, scrub, new song, etc.).
     */
    "timestamp": S.optionalWith(S.Int, { nullable: true }),
    /**
     * Progress into the currently playing track or episode. Can be `null`.
     */
    "progress_ms": S.optionalWith(S.Int, { nullable: true }),
    /**
     * If something is currently playing, return `true`.
     */
    "is_playing": S.optionalWith(S.Boolean, { nullable: true }),
    /**
     * The currently playing track or episode. Can be `null`.
     */
    "item": S.optionalWith(S.Union(TrackObject, EpisodeObject), { nullable: true }),
    /**
     * The object type of the currently playing item. Can be one of `track`, `episode`, `ad` or `unknown`.
     */
    "currently_playing_type": S.optionalWith(S.String, { nullable: true }),
    /**
     * Allows to update the user interface based on which playback actions are available within the current context.
     */
    "actions": S.optionalWith(DisallowsObject, { nullable: true })
  })
{}

export class GetInformationAboutTheUsersCurrentPlayback401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetInformationAboutTheUsersCurrentPlayback403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetInformationAboutTheUsersCurrentPlayback429 extends S.Struct({
  "error": ErrorObject
}) {}

export class TransferAUsersPlaybackRequest
  extends S.Class<TransferAUsersPlaybackRequest>("TransferAUsersPlaybackRequest")({
    /**
     * A JSON array containing the ID of the device on which playback should be started/transferred.<br/>For example:`{device_ids:["74ASZWbe4lXaubB36ztrGX"]}`<br/>_**Note**: Although an array is accepted, only a single device_id is currently supported. Supplying more than one will return `400 Bad Request`_
     */
    "device_ids": S.Array(S.String),
    /**
     * **true**: ensure playback happens on new device.<br/>**false** or not provided: keep the current playback state.
     */
    "play": S.optionalWith(S.Boolean, { nullable: true })
  })
{}

export class TransferAUsersPlayback401 extends S.Struct({
  "error": ErrorObject
}) {}

export class TransferAUsersPlayback403 extends S.Struct({
  "error": ErrorObject
}) {}

export class TransferAUsersPlayback429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAUsersAvailableDevices200 extends S.Struct({
  "devices": S.Array(DeviceObject)
}) {}

export class GetAUsersAvailableDevices401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAUsersAvailableDevices403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAUsersAvailableDevices429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetTheUsersCurrentlyPlayingTrackParams extends S.Struct({
  /**
   * An [ISO 3166-1 alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
   *   If a country code is specified, only content that is available in that market will be returned.<br/>
   *   If a valid user access token is specified in the request header, the country associated with
   *   the user account will take priority over this parameter.<br/>
   *   _**Note**: If neither market or user country are provided, the content is considered unavailable for the client._<br/>
   *   Users can view the country that is associated with their account in the [account settings](https://www.spotify.com/account/overview/).
   */
  "market": S.optionalWith(S.String, { nullable: true }),
  /**
   * A comma-separated list of item types that your client supports besides the default `track` type. Valid types are: `track` and `episode`.<br/>
   * _**Note**: This parameter was introduced to allow existing clients to maintain their current behaviour and might be deprecated in the future._<br/>
   * In addition to providing this parameter, make sure that your client properly handles cases of new types in the future by checking against the `type` field of each object.
   */
  "additional_types": S.optionalWith(S.String, { nullable: true })
}) {}

export class GetTheUsersCurrentlyPlayingTrack401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetTheUsersCurrentlyPlayingTrack403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetTheUsersCurrentlyPlayingTrack429 extends S.Struct({
  "error": ErrorObject
}) {}

export class StartAUsersPlaybackParams extends S.Struct({
  /**
   * The id of the device this command is targeting. If not supplied, the user's currently active device is the target.
   */
  "device_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class StartAUsersPlaybackRequest extends S.Class<StartAUsersPlaybackRequest>("StartAUsersPlaybackRequest")({
  /**
   * Optional. Spotify URI of the context to play.
   * Valid contexts are albums, artists & playlists.
   * `{context_uri:"spotify:album:1Je1IMUlBXcx1Fz0WE7oPT"}`
   */
  "context_uri": S.optionalWith(S.String, { nullable: true }),
  /**
   * Optional. A JSON array of the Spotify track URIs to play.
   * For example: `{"uris": ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh", "spotify:track:1301WleyT98MSxVHPZCA6M"]}`
   */
  "uris": S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * Optional. Indicates from where in the context playback should start. Only available when context_uri corresponds to an album or playlist object
   * "position" is zero based and can’t be negative. Example: `"offset": {"position": 5}`
   * "uri" is a string representing the uri of the item to start at. Example: `"offset": {"uri": "spotify:track:1301WleyT98MSxVHPZCA6M"}`
   */
  "offset": S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), { nullable: true }),
  /**
   * integer
   */
  "position_ms": S.optionalWith(S.Int, { nullable: true })
}) {}

export class StartAUsersPlayback401 extends S.Struct({
  "error": ErrorObject
}) {}

export class StartAUsersPlayback403 extends S.Struct({
  "error": ErrorObject
}) {}

export class StartAUsersPlayback429 extends S.Struct({
  "error": ErrorObject
}) {}

export class PauseAUsersPlaybackParams extends S.Struct({
  /**
   * The id of the device this command is targeting. If not supplied, the user's currently active device is the target.
   */
  "device_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class PauseAUsersPlayback401 extends S.Struct({
  "error": ErrorObject
}) {}

export class PauseAUsersPlayback403 extends S.Struct({
  "error": ErrorObject
}) {}

export class PauseAUsersPlayback429 extends S.Struct({
  "error": ErrorObject
}) {}

export class SkipUsersPlaybackToNextTrackParams extends S.Struct({
  /**
   * The id of the device this command is targeting. If not supplied, the user's currently active device is the target.
   */
  "device_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class SkipUsersPlaybackToNextTrack401 extends S.Struct({
  "error": ErrorObject
}) {}

export class SkipUsersPlaybackToNextTrack403 extends S.Struct({
  "error": ErrorObject
}) {}

export class SkipUsersPlaybackToNextTrack429 extends S.Struct({
  "error": ErrorObject
}) {}

export class SkipUsersPlaybackToPreviousTrackParams extends S.Struct({
  /**
   * The id of the device this command is targeting. If
   * not supplied, the user's currently active device is the target.
   */
  "device_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class SkipUsersPlaybackToPreviousTrack401 extends S.Struct({
  "error": ErrorObject
}) {}

export class SkipUsersPlaybackToPreviousTrack403 extends S.Struct({
  "error": ErrorObject
}) {}

export class SkipUsersPlaybackToPreviousTrack429 extends S.Struct({
  "error": ErrorObject
}) {}

export class SeekToPositionInCurrentlyPlayingTrackParams extends S.Struct({
  /**
   * The position in milliseconds to seek to. Must be a
   * positive number. Passing in a position that is greater than the length of
   * the track will cause the player to start playing the next song.
   */
  "position_ms": S.Int,
  /**
   * The id of the device this command is targeting. If
   * not supplied, the user's currently active device is the target.
   */
  "device_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class SeekToPositionInCurrentlyPlayingTrack401 extends S.Struct({
  "error": ErrorObject
}) {}

export class SeekToPositionInCurrentlyPlayingTrack403 extends S.Struct({
  "error": ErrorObject
}) {}

export class SeekToPositionInCurrentlyPlayingTrack429 extends S.Struct({
  "error": ErrorObject
}) {}

export class SetRepeatModeOnUsersPlaybackParams extends S.Struct({
  /**
   * **track**, **context** or **off**.<br/>
   * **track** will repeat the current track.<br/>
   * **context** will repeat the current context.<br/>
   * **off** will turn repeat off.
   */
  "state": S.String,
  /**
   * The id of the device this command is targeting. If
   * not supplied, the user's currently active device is the target.
   */
  "device_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class SetRepeatModeOnUsersPlayback401 extends S.Struct({
  "error": ErrorObject
}) {}

export class SetRepeatModeOnUsersPlayback403 extends S.Struct({
  "error": ErrorObject
}) {}

export class SetRepeatModeOnUsersPlayback429 extends S.Struct({
  "error": ErrorObject
}) {}

export class SetVolumeForUsersPlaybackParams extends S.Struct({
  /**
   * The volume to set. Must be a value from 0 to 100 inclusive.
   */
  "volume_percent": S.Int,
  /**
   * The id of the device this command is targeting. If not supplied, the user's currently active device is the target.
   */
  "device_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class SetVolumeForUsersPlayback401 extends S.Struct({
  "error": ErrorObject
}) {}

export class SetVolumeForUsersPlayback403 extends S.Struct({
  "error": ErrorObject
}) {}

export class SetVolumeForUsersPlayback429 extends S.Struct({
  "error": ErrorObject
}) {}

export class ToggleShuffleForUsersPlaybackParams extends S.Struct({
  /**
   * **true** : Shuffle user's playback.<br/>
   * **false** : Do not shuffle user's playback.
   */
  "state": S.Boolean,
  /**
   * The id of the device this command is targeting. If
   * not supplied, the user's currently active device is the target.
   */
  "device_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class ToggleShuffleForUsersPlayback401 extends S.Struct({
  "error": ErrorObject
}) {}

export class ToggleShuffleForUsersPlayback403 extends S.Struct({
  "error": ErrorObject
}) {}

export class ToggleShuffleForUsersPlayback429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetRecentlyPlayedParams extends S.Struct({
  /**
   * The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.
   */
  "limit": S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(50)), {
    nullable: true,
    default: () => 20 as const
  }),
  /**
   * A Unix timestamp in milliseconds. Returns all items
   * after (but not including) this cursor position. If `after` is specified, `before`
   * must not be specified.
   */
  "after": S.optionalWith(S.Int, { nullable: true }),
  /**
   * A Unix timestamp in milliseconds. Returns all items
   * before (but not including) this cursor position. If `before` is specified,
   * `after` must not be specified.
   */
  "before": S.optionalWith(S.Int, { nullable: true })
}) {}

export class PlayHistoryObject extends S.Class<PlayHistoryObject>("PlayHistoryObject")({
  /**
   * The track the user listened to.
   */
  "track": S.optionalWith(TrackObject, { nullable: true }),
  /**
   * The date and time the track was played.
   */
  "played_at": S.optionalWith(S.String, { nullable: true }),
  /**
   * The context the track was played from.
   */
  "context": S.optionalWith(ContextObject, { nullable: true })
}) {}

export class CursorPagingPlayHistoryObject
  extends S.Class<CursorPagingPlayHistoryObject>("CursorPagingPlayHistoryObject")({
    "items": S.optionalWith(S.Array(PlayHistoryObject), { nullable: true }),
    /**
     * A link to the Web API endpoint returning the full result of the request.
     */
    "href": S.optionalWith(S.String, { nullable: true }),
    /**
     * The maximum number of items in the response (as set in the query or by default).
     */
    "limit": S.optionalWith(S.Int, { nullable: true }),
    /**
     * URL to the next page of items. ( `null` if none)
     */
    "next": S.optionalWith(S.String, { nullable: true }),
    /**
     * The cursors used to find the next set of items.
     */
    "cursors": S.optionalWith(CursorObject, { nullable: true }),
    /**
     * The total number of items available to return.
     */
    "total": S.optionalWith(S.Int, { nullable: true })
  })
{}

export class GetRecentlyPlayed401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetRecentlyPlayed403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetRecentlyPlayed429 extends S.Struct({
  "error": ErrorObject
}) {}

export class QueueObject extends S.Class<QueueObject>("QueueObject")({
  /**
   * The currently playing track or episode. Can be `null`.
   */
  "currently_playing": S.optionalWith(S.Union(TrackObject, EpisodeObject), { nullable: true }),
  /**
   * The tracks or episodes in the queue. Can be empty.
   */
  "queue": S.optionalWith(S.Array(S.Union(TrackObject, EpisodeObject)), { nullable: true })
}) {}

export class GetQueue401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetQueue403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetQueue429 extends S.Struct({
  "error": ErrorObject
}) {}

export class AddToQueueParams extends S.Struct({
  /**
   * The uri of the item to add to the queue. Must be a track or an episode uri.
   */
  "uri": S.String,
  /**
   * The id of the device this command is targeting. If
   * not supplied, the user's currently active device is the target.
   */
  "device_id": S.optionalWith(S.String, { nullable: true })
}) {}

export class AddToQueue401 extends S.Struct({
  "error": ErrorObject
}) {}

export class AddToQueue403 extends S.Struct({
  "error": ErrorObject
}) {}

export class AddToQueue429 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAvailableMarkets200 extends S.Struct({
  "markets": S.optionalWith(S.Array(S.String), { nullable: true })
}) {}

export class GetAvailableMarkets401 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAvailableMarkets403 extends S.Struct({
  "error": ErrorObject
}) {}

export class GetAvailableMarkets429 extends S.Struct({
  "error": ErrorObject
}) {}

export const make = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>) | undefined
  } = {}
): Client => {
  const unexpectedStatus = (response: HttpClientResponse.HttpClientResponse) =>
    Effect.flatMap(
      Effect.orElseSucceed(response.json, () => "Unexpected status code"),
      (description) =>
        Effect.fail(
          new HttpClientError.ResponseError({
            request: response.request,
            response,
            reason: "StatusCode",
            description: typeof description === "string" ? description : JSON.stringify(description)
          })
        )
    )
  const withResponse: <A, E>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>
  ) => (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<any, any> = options.transformClient
    ? (f) => (request) =>
      Effect.flatMap(
        Effect.flatMap(options.transformClient!(httpClient), (client) => client.execute(request)),
        f
      )
    : (f) => (request) => Effect.flatMap(httpClient.execute(request), f)
  const decodeSuccess = <A, I, R>(schema: S.Schema<A, I, R>) => (response: HttpClientResponse.HttpClientResponse) =>
    HttpClientResponse.schemaBodyJson(schema)(response)
  const decodeError =
    <const Tag extends string, A, I, R>(tag: Tag, schema: S.Schema<A, I, R>) =>
    (response: HttpClientResponse.HttpClientResponse) =>
      Effect.flatMap(
        HttpClientResponse.schemaBodyJson(schema)(response),
        (cause) => Effect.fail(ClientError(tag, cause, response))
      )
  return {
    httpClient,
    "getAnAlbum": (id, options) =>
      HttpClientRequest.get(`/albums/${id}`).pipe(
        HttpClientRequest.setUrlParams({ "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(AlbumObject),
          "401": decodeError("GetAnAlbum401", GetAnAlbum401),
          "403": decodeError("GetAnAlbum403", GetAnAlbum403),
          "429": decodeError("GetAnAlbum429", GetAnAlbum429),
          orElse: unexpectedStatus
        }))
      ),
    "getMultipleAlbums": (options) =>
      HttpClientRequest.get(`/albums`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any, "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetMultipleAlbums200),
          "401": decodeError("GetMultipleAlbums401", GetMultipleAlbums401),
          "403": decodeError("GetMultipleAlbums403", GetMultipleAlbums403),
          "429": decodeError("GetMultipleAlbums429", GetMultipleAlbums429),
          orElse: unexpectedStatus
        }))
      ),
    "getAnAlbumsTracks": (id, options) =>
      HttpClientRequest.get(`/albums/${id}/tracks`).pipe(
        HttpClientRequest.setUrlParams({
          "market": options?.["market"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingSimplifiedTrackObject),
          "401": decodeError("GetAnAlbumsTracks401", GetAnAlbumsTracks401),
          "403": decodeError("GetAnAlbumsTracks403", GetAnAlbumsTracks403),
          "429": decodeError("GetAnAlbumsTracks429", GetAnAlbumsTracks429),
          orElse: unexpectedStatus
        }))
      ),
    "getAnArtist": (id, options) =>
      HttpClientRequest.get(`/artists/${id}`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(ArtistObject),
          "401": decodeError("GetAnArtist401", GetAnArtist401),
          "403": decodeError("GetAnArtist403", GetAnArtist403),
          "429": decodeError("GetAnArtist429", GetAnArtist429),
          orElse: unexpectedStatus
        }))
      ),
    "getMultipleArtists": (options) =>
      HttpClientRequest.get(`/artists`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetMultipleArtists200),
          "401": decodeError("GetMultipleArtists401", GetMultipleArtists401),
          "403": decodeError("GetMultipleArtists403", GetMultipleArtists403),
          "429": decodeError("GetMultipleArtists429", GetMultipleArtists429),
          orElse: unexpectedStatus
        }))
      ),
    "getAnArtistsAlbums": (id, options) =>
      HttpClientRequest.get(`/artists/${id}/albums`).pipe(
        HttpClientRequest.setUrlParams({
          "include_groups": options?.["include_groups"] as any,
          "market": options?.["market"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingArtistDiscographyAlbumObject),
          "401": decodeError("GetAnArtistsAlbums401", GetAnArtistsAlbums401),
          "403": decodeError("GetAnArtistsAlbums403", GetAnArtistsAlbums403),
          "429": decodeError("GetAnArtistsAlbums429", GetAnArtistsAlbums429),
          orElse: unexpectedStatus
        }))
      ),
    "getAnArtistsTopTracks": (id, options) =>
      HttpClientRequest.get(`/artists/${id}/top-tracks`).pipe(
        HttpClientRequest.setUrlParams({ "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetAnArtistsTopTracks200),
          "401": decodeError("GetAnArtistsTopTracks401", GetAnArtistsTopTracks401),
          "403": decodeError("GetAnArtistsTopTracks403", GetAnArtistsTopTracks403),
          "429": decodeError("GetAnArtistsTopTracks429", GetAnArtistsTopTracks429),
          orElse: unexpectedStatus
        }))
      ),
    "getAnArtistsRelatedArtists": (id, options) =>
      HttpClientRequest.get(`/artists/${id}/related-artists`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetAnArtistsRelatedArtists200),
          "401": decodeError("GetAnArtistsRelatedArtists401", GetAnArtistsRelatedArtists401),
          "403": decodeError("GetAnArtistsRelatedArtists403", GetAnArtistsRelatedArtists403),
          "429": decodeError("GetAnArtistsRelatedArtists429", GetAnArtistsRelatedArtists429),
          orElse: unexpectedStatus
        }))
      ),
    "getAShow": (id, options) =>
      HttpClientRequest.get(`/shows/${id}`).pipe(
        HttpClientRequest.setUrlParams({ "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(ShowObject),
          "401": decodeError("GetAShow401", GetAShow401),
          "403": decodeError("GetAShow403", GetAShow403),
          "429": decodeError("GetAShow429", GetAShow429),
          orElse: unexpectedStatus
        }))
      ),
    "getMultipleShows": (options) =>
      HttpClientRequest.get(`/shows`).pipe(
        HttpClientRequest.setUrlParams({ "market": options?.["market"] as any, "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetMultipleShows200),
          "401": decodeError("GetMultipleShows401", GetMultipleShows401),
          "403": decodeError("GetMultipleShows403", GetMultipleShows403),
          "429": decodeError("GetMultipleShows429", GetMultipleShows429),
          orElse: unexpectedStatus
        }))
      ),
    "getAShowsEpisodes": (id, options) =>
      HttpClientRequest.get(`/shows/${id}/episodes`).pipe(
        HttpClientRequest.setUrlParams({
          "market": options?.["market"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingSimplifiedEpisodeObject),
          "401": decodeError("GetAShowsEpisodes401", GetAShowsEpisodes401),
          "403": decodeError("GetAShowsEpisodes403", GetAShowsEpisodes403),
          "429": decodeError("GetAShowsEpisodes429", GetAShowsEpisodes429),
          orElse: unexpectedStatus
        }))
      ),
    "getAnEpisode": (id, options) =>
      HttpClientRequest.get(`/episodes/${id}`).pipe(
        HttpClientRequest.setUrlParams({ "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(EpisodeObject),
          "401": decodeError("GetAnEpisode401", GetAnEpisode401),
          "403": decodeError("GetAnEpisode403", GetAnEpisode403),
          "429": decodeError("GetAnEpisode429", GetAnEpisode429),
          orElse: unexpectedStatus
        }))
      ),
    "getMultipleEpisodes": (options) =>
      HttpClientRequest.get(`/episodes`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any, "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetMultipleEpisodes200),
          "401": decodeError("GetMultipleEpisodes401", GetMultipleEpisodes401),
          "403": decodeError("GetMultipleEpisodes403", GetMultipleEpisodes403),
          "429": decodeError("GetMultipleEpisodes429", GetMultipleEpisodes429),
          orElse: unexpectedStatus
        }))
      ),
    "getAnAudiobook": (id, options) =>
      HttpClientRequest.get(`/audiobooks/${id}`).pipe(
        HttpClientRequest.setUrlParams({ "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(AudiobookObject),
          "400": decodeError("GetAnAudiobook400", GetAnAudiobook400),
          "401": decodeError("GetAnAudiobook401", GetAnAudiobook401),
          "403": decodeError("GetAnAudiobook403", GetAnAudiobook403),
          "404": decodeError("GetAnAudiobook404", GetAnAudiobook404),
          "429": decodeError("GetAnAudiobook429", GetAnAudiobook429),
          orElse: unexpectedStatus
        }))
      ),
    "getMultipleAudiobooks": (options) =>
      HttpClientRequest.get(`/audiobooks`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any, "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetMultipleAudiobooks200),
          "401": decodeError("GetMultipleAudiobooks401", GetMultipleAudiobooks401),
          "403": decodeError("GetMultipleAudiobooks403", GetMultipleAudiobooks403),
          "429": decodeError("GetMultipleAudiobooks429", GetMultipleAudiobooks429),
          orElse: unexpectedStatus
        }))
      ),
    "getAudiobookChapters": (id, options) =>
      HttpClientRequest.get(`/audiobooks/${id}/chapters`).pipe(
        HttpClientRequest.setUrlParams({
          "market": options?.["market"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingSimplifiedChapterObject),
          "401": decodeError("GetAudiobookChapters401", GetAudiobookChapters401),
          "403": decodeError("GetAudiobookChapters403", GetAudiobookChapters403),
          "429": decodeError("GetAudiobookChapters429", GetAudiobookChapters429),
          orElse: unexpectedStatus
        }))
      ),
    "getUsersSavedAudiobooks": (options) =>
      HttpClientRequest.get(`/me/audiobooks`).pipe(
        HttpClientRequest.setUrlParams({ "limit": options?.["limit"] as any, "offset": options?.["offset"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingSimplifiedAudiobookObject),
          "401": decodeError("GetUsersSavedAudiobooks401", GetUsersSavedAudiobooks401),
          "403": decodeError("GetUsersSavedAudiobooks403", GetUsersSavedAudiobooks403),
          "429": decodeError("GetUsersSavedAudiobooks429", GetUsersSavedAudiobooks429),
          orElse: unexpectedStatus
        }))
      ),
    "saveAudiobooksUser": (options) =>
      HttpClientRequest.put(`/me/audiobooks`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("SaveAudiobooksUser401", SaveAudiobooksUser401),
          "403": decodeError("SaveAudiobooksUser403", SaveAudiobooksUser403),
          "429": decodeError("SaveAudiobooksUser429", SaveAudiobooksUser429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "removeAudiobooksUser": (options) =>
      HttpClientRequest.del(`/me/audiobooks`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("RemoveAudiobooksUser401", RemoveAudiobooksUser401),
          "403": decodeError("RemoveAudiobooksUser403", RemoveAudiobooksUser403),
          "429": decodeError("RemoveAudiobooksUser429", RemoveAudiobooksUser429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "checkUsersSavedAudiobooks": (options) =>
      HttpClientRequest.get(`/me/audiobooks/contains`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CheckUsersSavedAudiobooks200),
          "401": decodeError("CheckUsersSavedAudiobooks401", CheckUsersSavedAudiobooks401),
          "403": decodeError("CheckUsersSavedAudiobooks403", CheckUsersSavedAudiobooks403),
          "429": decodeError("CheckUsersSavedAudiobooks429", CheckUsersSavedAudiobooks429),
          orElse: unexpectedStatus
        }))
      ),
    "getAChapter": (id, options) =>
      HttpClientRequest.get(`/chapters/${id}`).pipe(
        HttpClientRequest.setUrlParams({ "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(ChapterObject),
          "401": decodeError("GetAChapter401", GetAChapter401),
          "403": decodeError("GetAChapter403", GetAChapter403),
          "429": decodeError("GetAChapter429", GetAChapter429),
          orElse: unexpectedStatus
        }))
      ),
    "getSeveralChapters": (options) =>
      HttpClientRequest.get(`/chapters`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any, "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetSeveralChapters200),
          "401": decodeError("GetSeveralChapters401", GetSeveralChapters401),
          "403": decodeError("GetSeveralChapters403", GetSeveralChapters403),
          "429": decodeError("GetSeveralChapters429", GetSeveralChapters429),
          orElse: unexpectedStatus
        }))
      ),
    "getTrack": (id, options) =>
      HttpClientRequest.get(`/tracks/${id}`).pipe(
        HttpClientRequest.setUrlParams({ "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(TrackObject),
          "401": decodeError("GetTrack401", GetTrack401),
          "403": decodeError("GetTrack403", GetTrack403),
          "429": decodeError("GetTrack429", GetTrack429),
          orElse: unexpectedStatus
        }))
      ),
    "getSeveralTracks": (options) =>
      HttpClientRequest.get(`/tracks`).pipe(
        HttpClientRequest.setUrlParams({ "market": options?.["market"] as any, "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetSeveralTracks200),
          "401": decodeError("GetSeveralTracks401", GetSeveralTracks401),
          "403": decodeError("GetSeveralTracks403", GetSeveralTracks403),
          "429": decodeError("GetSeveralTracks429", GetSeveralTracks429),
          orElse: unexpectedStatus
        }))
      ),
    "search": (options) =>
      HttpClientRequest.get(`/search`).pipe(
        HttpClientRequest.setUrlParams({
          "q": options?.["q"] as any,
          "type": options?.["type"] as any,
          "market": options?.["market"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any,
          "include_external": options?.["include_external"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(Search200),
          "401": decodeError("Search401", Search401),
          "403": decodeError("Search403", Search403),
          "429": decodeError("Search429", Search429),
          orElse: unexpectedStatus
        }))
      ),
    "getCurrentUsersProfile": () =>
      HttpClientRequest.get(`/me`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PrivateUserObject),
          "401": decodeError("GetCurrentUsersProfile401", GetCurrentUsersProfile401),
          "403": decodeError("GetCurrentUsersProfile403", GetCurrentUsersProfile403),
          "429": decodeError("GetCurrentUsersProfile429", GetCurrentUsersProfile429),
          orElse: unexpectedStatus
        }))
      ),
    "getPlaylist": (playlistId, options) =>
      HttpClientRequest.get(`/playlists/${playlistId}`).pipe(
        HttpClientRequest.setUrlParams({
          "market": options?.["market"] as any,
          "fields": options?.["fields"] as any,
          "additional_types": options?.["additional_types"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PlaylistObject),
          "401": decodeError("GetPlaylist401", GetPlaylist401),
          "403": decodeError("GetPlaylist403", GetPlaylist403),
          "429": decodeError("GetPlaylist429", GetPlaylist429),
          orElse: unexpectedStatus
        }))
      ),
    "changePlaylistDetails": (playlistId, options) =>
      HttpClientRequest.put(`/playlists/${playlistId}`).pipe(
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("ChangePlaylistDetails401", ChangePlaylistDetails401),
          "403": decodeError("ChangePlaylistDetails403", ChangePlaylistDetails403),
          "429": decodeError("ChangePlaylistDetails429", ChangePlaylistDetails429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "getPlaylistsTracks": (playlistId, options) =>
      HttpClientRequest.get(`/playlists/${playlistId}/tracks`).pipe(
        HttpClientRequest.setUrlParams({
          "market": options?.["market"] as any,
          "fields": options?.["fields"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any,
          "additional_types": options?.["additional_types"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingPlaylistTrackObject),
          "401": decodeError("GetPlaylistsTracks401", GetPlaylistsTracks401),
          "403": decodeError("GetPlaylistsTracks403", GetPlaylistsTracks403),
          "429": decodeError("GetPlaylistsTracks429", GetPlaylistsTracks429),
          orElse: unexpectedStatus
        }))
      ),
    "reorderOrReplacePlaylistsTracks": (playlistId, options) =>
      HttpClientRequest.put(`/playlists/${playlistId}/tracks`).pipe(
        HttpClientRequest.setUrlParams({ "uris": options.params?.["uris"] as any }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(ReorderOrReplacePlaylistsTracks200),
          "401": decodeError("ReorderOrReplacePlaylistsTracks401", ReorderOrReplacePlaylistsTracks401),
          "403": decodeError("ReorderOrReplacePlaylistsTracks403", ReorderOrReplacePlaylistsTracks403),
          "429": decodeError("ReorderOrReplacePlaylistsTracks429", ReorderOrReplacePlaylistsTracks429),
          orElse: unexpectedStatus
        }))
      ),
    "addTracksToPlaylist": (playlistId, options) =>
      HttpClientRequest.post(`/playlists/${playlistId}/tracks`).pipe(
        HttpClientRequest.setUrlParams({
          "position": options.params?.["position"] as any,
          "uris": options.params?.["uris"] as any
        }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(AddTracksToPlaylist201),
          "401": decodeError("AddTracksToPlaylist401", AddTracksToPlaylist401),
          "403": decodeError("AddTracksToPlaylist403", AddTracksToPlaylist403),
          "429": decodeError("AddTracksToPlaylist429", AddTracksToPlaylist429),
          orElse: unexpectedStatus
        }))
      ),
    "removeTracksPlaylist": (playlistId, options) =>
      HttpClientRequest.del(`/playlists/${playlistId}/tracks`).pipe(
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(RemoveTracksPlaylist200),
          "401": decodeError("RemoveTracksPlaylist401", RemoveTracksPlaylist401),
          "403": decodeError("RemoveTracksPlaylist403", RemoveTracksPlaylist403),
          "429": decodeError("RemoveTracksPlaylist429", RemoveTracksPlaylist429),
          orElse: unexpectedStatus
        }))
      ),
    "getAListOfCurrentUsersPlaylists": (options) =>
      HttpClientRequest.get(`/me/playlists`).pipe(
        HttpClientRequest.setUrlParams({ "limit": options?.["limit"] as any, "offset": options?.["offset"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingPlaylistObject),
          "401": decodeError("GetAListOfCurrentUsersPlaylists401", GetAListOfCurrentUsersPlaylists401),
          "403": decodeError("GetAListOfCurrentUsersPlaylists403", GetAListOfCurrentUsersPlaylists403),
          "429": decodeError("GetAListOfCurrentUsersPlaylists429", GetAListOfCurrentUsersPlaylists429),
          orElse: unexpectedStatus
        }))
      ),
    "getUsersSavedAlbums": (options) =>
      HttpClientRequest.get(`/me/albums`).pipe(
        HttpClientRequest.setUrlParams({
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any,
          "market": options?.["market"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingSavedAlbumObject),
          "401": decodeError("GetUsersSavedAlbums401", GetUsersSavedAlbums401),
          "403": decodeError("GetUsersSavedAlbums403", GetUsersSavedAlbums403),
          "429": decodeError("GetUsersSavedAlbums429", GetUsersSavedAlbums429),
          orElse: unexpectedStatus
        }))
      ),
    "saveAlbumsUser": (options) =>
      HttpClientRequest.put(`/me/albums`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options.params?.["ids"] as any }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("SaveAlbumsUser401", SaveAlbumsUser401),
          "403": decodeError("SaveAlbumsUser403", SaveAlbumsUser403),
          "429": decodeError("SaveAlbumsUser429", SaveAlbumsUser429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "removeAlbumsUser": (options) =>
      HttpClientRequest.del(`/me/albums`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options.params?.["ids"] as any }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("RemoveAlbumsUser401", RemoveAlbumsUser401),
          "403": decodeError("RemoveAlbumsUser403", RemoveAlbumsUser403),
          "429": decodeError("RemoveAlbumsUser429", RemoveAlbumsUser429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "checkUsersSavedAlbums": (options) =>
      HttpClientRequest.get(`/me/albums/contains`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CheckUsersSavedAlbums200),
          "401": decodeError("CheckUsersSavedAlbums401", CheckUsersSavedAlbums401),
          "403": decodeError("CheckUsersSavedAlbums403", CheckUsersSavedAlbums403),
          "429": decodeError("CheckUsersSavedAlbums429", CheckUsersSavedAlbums429),
          orElse: unexpectedStatus
        }))
      ),
    "getUsersSavedTracks": (options) =>
      HttpClientRequest.get(`/me/tracks`).pipe(
        HttpClientRequest.setUrlParams({
          "market": options?.["market"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingSavedTrackObject),
          "401": decodeError("GetUsersSavedTracks401", GetUsersSavedTracks401),
          "403": decodeError("GetUsersSavedTracks403", GetUsersSavedTracks403),
          "429": decodeError("GetUsersSavedTracks429", GetUsersSavedTracks429),
          orElse: unexpectedStatus
        }))
      ),
    "saveTracksUser": (options) =>
      HttpClientRequest.put(`/me/tracks`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options.params?.["ids"] as any }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("SaveTracksUser401", SaveTracksUser401),
          "403": decodeError("SaveTracksUser403", SaveTracksUser403),
          "429": decodeError("SaveTracksUser429", SaveTracksUser429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "removeTracksUser": (options) =>
      HttpClientRequest.del(`/me/tracks`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options.params?.["ids"] as any }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("RemoveTracksUser401", RemoveTracksUser401),
          "403": decodeError("RemoveTracksUser403", RemoveTracksUser403),
          "429": decodeError("RemoveTracksUser429", RemoveTracksUser429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "checkUsersSavedTracks": (options) =>
      HttpClientRequest.get(`/me/tracks/contains`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CheckUsersSavedTracks200),
          "401": decodeError("CheckUsersSavedTracks401", CheckUsersSavedTracks401),
          "403": decodeError("CheckUsersSavedTracks403", CheckUsersSavedTracks403),
          "429": decodeError("CheckUsersSavedTracks429", CheckUsersSavedTracks429),
          orElse: unexpectedStatus
        }))
      ),
    "getUsersSavedEpisodes": (options) =>
      HttpClientRequest.get(`/me/episodes`).pipe(
        HttpClientRequest.setUrlParams({
          "market": options?.["market"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingSavedEpisodeObject),
          "401": decodeError("GetUsersSavedEpisodes401", GetUsersSavedEpisodes401),
          "403": decodeError("GetUsersSavedEpisodes403", GetUsersSavedEpisodes403),
          "429": decodeError("GetUsersSavedEpisodes429", GetUsersSavedEpisodes429),
          orElse: unexpectedStatus
        }))
      ),
    "saveEpisodesUser": (options) =>
      HttpClientRequest.put(`/me/episodes`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options.params?.["ids"] as any }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("SaveEpisodesUser401", SaveEpisodesUser401),
          "403": decodeError("SaveEpisodesUser403", SaveEpisodesUser403),
          "429": decodeError("SaveEpisodesUser429", SaveEpisodesUser429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "removeEpisodesUser": (options) =>
      HttpClientRequest.del(`/me/episodes`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options.params?.["ids"] as any }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("RemoveEpisodesUser401", RemoveEpisodesUser401),
          "403": decodeError("RemoveEpisodesUser403", RemoveEpisodesUser403),
          "429": decodeError("RemoveEpisodesUser429", RemoveEpisodesUser429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "checkUsersSavedEpisodes": (options) =>
      HttpClientRequest.get(`/me/episodes/contains`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CheckUsersSavedEpisodes200),
          "401": decodeError("CheckUsersSavedEpisodes401", CheckUsersSavedEpisodes401),
          "403": decodeError("CheckUsersSavedEpisodes403", CheckUsersSavedEpisodes403),
          "429": decodeError("CheckUsersSavedEpisodes429", CheckUsersSavedEpisodes429),
          orElse: unexpectedStatus
        }))
      ),
    "getUsersSavedShows": (options) =>
      HttpClientRequest.get(`/me/shows`).pipe(
        HttpClientRequest.setUrlParams({ "limit": options?.["limit"] as any, "offset": options?.["offset"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingSavedShowObject),
          "401": decodeError("GetUsersSavedShows401", GetUsersSavedShows401),
          "403": decodeError("GetUsersSavedShows403", GetUsersSavedShows403),
          "429": decodeError("GetUsersSavedShows429", GetUsersSavedShows429),
          orElse: unexpectedStatus
        }))
      ),
    "saveShowsUser": (options) =>
      HttpClientRequest.put(`/me/shows`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("SaveShowsUser401", SaveShowsUser401),
          "403": decodeError("SaveShowsUser403", SaveShowsUser403),
          "429": decodeError("SaveShowsUser429", SaveShowsUser429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "removeShowsUser": (options) =>
      HttpClientRequest.del(`/me/shows`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any, "market": options?.["market"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("RemoveShowsUser401", RemoveShowsUser401),
          "403": decodeError("RemoveShowsUser403", RemoveShowsUser403),
          "429": decodeError("RemoveShowsUser429", RemoveShowsUser429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "checkUsersSavedShows": (options) =>
      HttpClientRequest.get(`/me/shows/contains`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CheckUsersSavedShows200),
          "401": decodeError("CheckUsersSavedShows401", CheckUsersSavedShows401),
          "403": decodeError("CheckUsersSavedShows403", CheckUsersSavedShows403),
          "429": decodeError("CheckUsersSavedShows429", CheckUsersSavedShows429),
          orElse: unexpectedStatus
        }))
      ),
    "getUsersTopArtistsAndTracks": (type, options) =>
      HttpClientRequest.get(`/me/top/${type}`).pipe(
        HttpClientRequest.setUrlParams({
          "time_range": options?.["time_range"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetUsersTopArtistsAndTracks200),
          "401": decodeError("GetUsersTopArtistsAndTracks401", GetUsersTopArtistsAndTracks401),
          "403": decodeError("GetUsersTopArtistsAndTracks403", GetUsersTopArtistsAndTracks403),
          "429": decodeError("GetUsersTopArtistsAndTracks429", GetUsersTopArtistsAndTracks429),
          orElse: unexpectedStatus
        }))
      ),
    "getUsersProfile": (userId, options) =>
      HttpClientRequest.get(`/users/${userId}`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PublicUserObject),
          "401": decodeError("GetUsersProfile401", GetUsersProfile401),
          "403": decodeError("GetUsersProfile403", GetUsersProfile403),
          "429": decodeError("GetUsersProfile429", GetUsersProfile429),
          orElse: unexpectedStatus
        }))
      ),
    "getListUsersPlaylists": (userId, options) =>
      HttpClientRequest.get(`/users/${userId}/playlists`).pipe(
        HttpClientRequest.setUrlParams({ "limit": options?.["limit"] as any, "offset": options?.["offset"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingPlaylistObject),
          "401": decodeError("GetListUsersPlaylists401", GetListUsersPlaylists401),
          "403": decodeError("GetListUsersPlaylists403", GetListUsersPlaylists403),
          "429": decodeError("GetListUsersPlaylists429", GetListUsersPlaylists429),
          orElse: unexpectedStatus
        }))
      ),
    "createPlaylist": (userId, options) =>
      HttpClientRequest.post(`/users/${userId}/playlists`).pipe(
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PlaylistObject),
          "401": decodeError("CreatePlaylist401", CreatePlaylist401),
          "403": decodeError("CreatePlaylist403", CreatePlaylist403),
          "429": decodeError("CreatePlaylist429", CreatePlaylist429),
          orElse: unexpectedStatus
        }))
      ),
    "followPlaylist": (playlistId, options) =>
      HttpClientRequest.put(`/playlists/${playlistId}/followers`).pipe(
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("FollowPlaylist401", FollowPlaylist401),
          "403": decodeError("FollowPlaylist403", FollowPlaylist403),
          "429": decodeError("FollowPlaylist429", FollowPlaylist429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "unfollowPlaylist": (playlistId, options) =>
      HttpClientRequest.del(`/playlists/${playlistId}/followers`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("UnfollowPlaylist401", UnfollowPlaylist401),
          "403": decodeError("UnfollowPlaylist403", UnfollowPlaylist403),
          "429": decodeError("UnfollowPlaylist429", UnfollowPlaylist429),
          "200": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "getFeaturedPlaylists": (options) =>
      HttpClientRequest.get(`/browse/featured-playlists`).pipe(
        HttpClientRequest.setUrlParams({
          "locale": options?.["locale"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingFeaturedPlaylistObject),
          "401": decodeError("GetFeaturedPlaylists401", GetFeaturedPlaylists401),
          "403": decodeError("GetFeaturedPlaylists403", GetFeaturedPlaylists403),
          "429": decodeError("GetFeaturedPlaylists429", GetFeaturedPlaylists429),
          orElse: unexpectedStatus
        }))
      ),
    "getCategories": (options) =>
      HttpClientRequest.get(`/browse/categories`).pipe(
        HttpClientRequest.setUrlParams({
          "locale": options?.["locale"] as any,
          "limit": options?.["limit"] as any,
          "offset": options?.["offset"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetCategories200),
          "401": decodeError("GetCategories401", GetCategories401),
          "403": decodeError("GetCategories403", GetCategories403),
          "429": decodeError("GetCategories429", GetCategories429),
          orElse: unexpectedStatus
        }))
      ),
    "getACategory": (categoryId, options) =>
      HttpClientRequest.get(`/browse/categories/${categoryId}`).pipe(
        HttpClientRequest.setUrlParams({ "locale": options?.["locale"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CategoryObject),
          "401": decodeError("GetACategory401", GetACategory401),
          "403": decodeError("GetACategory403", GetACategory403),
          "429": decodeError("GetACategory429", GetACategory429),
          orElse: unexpectedStatus
        }))
      ),
    "getACategoriesPlaylists": (categoryId, options) =>
      HttpClientRequest.get(`/browse/categories/${categoryId}/playlists`).pipe(
        HttpClientRequest.setUrlParams({ "limit": options?.["limit"] as any, "offset": options?.["offset"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(PagingFeaturedPlaylistObject),
          "401": decodeError("GetACategoriesPlaylists401", GetACategoriesPlaylists401),
          "403": decodeError("GetACategoriesPlaylists403", GetACategoriesPlaylists403),
          "429": decodeError("GetACategoriesPlaylists429", GetACategoriesPlaylists429),
          orElse: unexpectedStatus
        }))
      ),
    "getPlaylistCover": (playlistId, options) =>
      HttpClientRequest.get(`/playlists/${playlistId}/images`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetPlaylistCover200),
          "401": decodeError("GetPlaylistCover401", GetPlaylistCover401),
          "403": decodeError("GetPlaylistCover403", GetPlaylistCover403),
          "429": decodeError("GetPlaylistCover429", GetPlaylistCover429),
          orElse: unexpectedStatus
        }))
      ),
    "uploadCustomPlaylistCover": (playlistId, options) =>
      HttpClientRequest.put(`/playlists/${playlistId}/images`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("UploadCustomPlaylistCover401", UploadCustomPlaylistCover401),
          "403": decodeError("UploadCustomPlaylistCover403", UploadCustomPlaylistCover403),
          "429": decodeError("UploadCustomPlaylistCover429", UploadCustomPlaylistCover429),
          "202": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "getNewReleases": (options) =>
      HttpClientRequest.get(`/browse/new-releases`).pipe(
        HttpClientRequest.setUrlParams({ "limit": options?.["limit"] as any, "offset": options?.["offset"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetNewReleases200),
          "401": decodeError("GetNewReleases401", GetNewReleases401),
          "403": decodeError("GetNewReleases403", GetNewReleases403),
          "429": decodeError("GetNewReleases429", GetNewReleases429),
          orElse: unexpectedStatus
        }))
      ),
    "getFollowed": (options) =>
      HttpClientRequest.get(`/me/following`).pipe(
        HttpClientRequest.setUrlParams({
          "type": options?.["type"] as any,
          "after": options?.["after"] as any,
          "limit": options?.["limit"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetFollowed200),
          "401": decodeError("GetFollowed401", GetFollowed401),
          "403": decodeError("GetFollowed403", GetFollowed403),
          "429": decodeError("GetFollowed429", GetFollowed429),
          orElse: unexpectedStatus
        }))
      ),
    "followArtistsUsers": (options) =>
      HttpClientRequest.put(`/me/following`).pipe(
        HttpClientRequest.setUrlParams({
          "type": options.params?.["type"] as any,
          "ids": options.params?.["ids"] as any
        }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("FollowArtistsUsers401", FollowArtistsUsers401),
          "403": decodeError("FollowArtistsUsers403", FollowArtistsUsers403),
          "429": decodeError("FollowArtistsUsers429", FollowArtistsUsers429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "unfollowArtistsUsers": (options) =>
      HttpClientRequest.del(`/me/following`).pipe(
        HttpClientRequest.setUrlParams({
          "type": options.params?.["type"] as any,
          "ids": options.params?.["ids"] as any
        }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("UnfollowArtistsUsers401", UnfollowArtistsUsers401),
          "403": decodeError("UnfollowArtistsUsers403", UnfollowArtistsUsers403),
          "429": decodeError("UnfollowArtistsUsers429", UnfollowArtistsUsers429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "checkCurrentUserFollows": (options) =>
      HttpClientRequest.get(`/me/following/contains`).pipe(
        HttpClientRequest.setUrlParams({ "type": options?.["type"] as any, "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CheckCurrentUserFollows200),
          "401": decodeError("CheckCurrentUserFollows401", CheckCurrentUserFollows401),
          "403": decodeError("CheckCurrentUserFollows403", CheckCurrentUserFollows403),
          "429": decodeError("CheckCurrentUserFollows429", CheckCurrentUserFollows429),
          orElse: unexpectedStatus
        }))
      ),
    "checkIfUserFollowsPlaylist": (playlistId, options) =>
      HttpClientRequest.get(`/playlists/${playlistId}/followers/contains`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CheckIfUserFollowsPlaylist200),
          "401": decodeError("CheckIfUserFollowsPlaylist401", CheckIfUserFollowsPlaylist401),
          "403": decodeError("CheckIfUserFollowsPlaylist403", CheckIfUserFollowsPlaylist403),
          "429": decodeError("CheckIfUserFollowsPlaylist429", CheckIfUserFollowsPlaylist429),
          orElse: unexpectedStatus
        }))
      ),
    "getSeveralAudioFeatures": (options) =>
      HttpClientRequest.get(`/audio-features`).pipe(
        HttpClientRequest.setUrlParams({ "ids": options?.["ids"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetSeveralAudioFeatures200),
          "401": decodeError("GetSeveralAudioFeatures401", GetSeveralAudioFeatures401),
          "403": decodeError("GetSeveralAudioFeatures403", GetSeveralAudioFeatures403),
          "429": decodeError("GetSeveralAudioFeatures429", GetSeveralAudioFeatures429),
          orElse: unexpectedStatus
        }))
      ),
    "getAudioFeatures": (id) =>
      HttpClientRequest.get(`/audio-features/${id}`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(AudioFeaturesObject),
          "401": decodeError("GetAudioFeatures401", GetAudioFeatures401),
          "403": decodeError("GetAudioFeatures403", GetAudioFeatures403),
          "429": decodeError("GetAudioFeatures429", GetAudioFeatures429),
          orElse: unexpectedStatus
        }))
      ),
    "getAudioAnalysis": (id) =>
      HttpClientRequest.get(`/audio-analysis/${id}`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(AudioAnalysisObject),
          "401": decodeError("GetAudioAnalysis401", GetAudioAnalysis401),
          "403": decodeError("GetAudioAnalysis403", GetAudioAnalysis403),
          "429": decodeError("GetAudioAnalysis429", GetAudioAnalysis429),
          orElse: unexpectedStatus
        }))
      ),
    "getRecommendations": (options) =>
      HttpClientRequest.get(`/recommendations`).pipe(
        HttpClientRequest.setUrlParams({
          "limit": options?.["limit"] as any,
          "market": options?.["market"] as any,
          "seed_artists": options?.["seed_artists"] as any,
          "seed_genres": options?.["seed_genres"] as any,
          "seed_tracks": options?.["seed_tracks"] as any,
          "min_acousticness": options?.["min_acousticness"] as any,
          "max_acousticness": options?.["max_acousticness"] as any,
          "target_acousticness": options?.["target_acousticness"] as any,
          "min_danceability": options?.["min_danceability"] as any,
          "max_danceability": options?.["max_danceability"] as any,
          "target_danceability": options?.["target_danceability"] as any,
          "min_duration_ms": options?.["min_duration_ms"] as any,
          "max_duration_ms": options?.["max_duration_ms"] as any,
          "target_duration_ms": options?.["target_duration_ms"] as any,
          "min_energy": options?.["min_energy"] as any,
          "max_energy": options?.["max_energy"] as any,
          "target_energy": options?.["target_energy"] as any,
          "min_instrumentalness": options?.["min_instrumentalness"] as any,
          "max_instrumentalness": options?.["max_instrumentalness"] as any,
          "target_instrumentalness": options?.["target_instrumentalness"] as any,
          "min_key": options?.["min_key"] as any,
          "max_key": options?.["max_key"] as any,
          "target_key": options?.["target_key"] as any,
          "min_liveness": options?.["min_liveness"] as any,
          "max_liveness": options?.["max_liveness"] as any,
          "target_liveness": options?.["target_liveness"] as any,
          "min_loudness": options?.["min_loudness"] as any,
          "max_loudness": options?.["max_loudness"] as any,
          "target_loudness": options?.["target_loudness"] as any,
          "min_mode": options?.["min_mode"] as any,
          "max_mode": options?.["max_mode"] as any,
          "target_mode": options?.["target_mode"] as any,
          "min_popularity": options?.["min_popularity"] as any,
          "max_popularity": options?.["max_popularity"] as any,
          "target_popularity": options?.["target_popularity"] as any,
          "min_speechiness": options?.["min_speechiness"] as any,
          "max_speechiness": options?.["max_speechiness"] as any,
          "target_speechiness": options?.["target_speechiness"] as any,
          "min_tempo": options?.["min_tempo"] as any,
          "max_tempo": options?.["max_tempo"] as any,
          "target_tempo": options?.["target_tempo"] as any,
          "min_time_signature": options?.["min_time_signature"] as any,
          "max_time_signature": options?.["max_time_signature"] as any,
          "target_time_signature": options?.["target_time_signature"] as any,
          "min_valence": options?.["min_valence"] as any,
          "max_valence": options?.["max_valence"] as any,
          "target_valence": options?.["target_valence"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(RecommendationsObject),
          "401": decodeError("GetRecommendations401", GetRecommendations401),
          "403": decodeError("GetRecommendations403", GetRecommendations403),
          "429": decodeError("GetRecommendations429", GetRecommendations429),
          orElse: unexpectedStatus
        }))
      ),
    "getRecommendationGenres": () =>
      HttpClientRequest.get(`/recommendations/available-genre-seeds`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetRecommendationGenres200),
          "401": decodeError("GetRecommendationGenres401", GetRecommendationGenres401),
          "403": decodeError("GetRecommendationGenres403", GetRecommendationGenres403),
          "429": decodeError("GetRecommendationGenres429", GetRecommendationGenres429),
          orElse: unexpectedStatus
        }))
      ),
    "getInformationAboutTheUsersCurrentPlayback": (options) =>
      HttpClientRequest.get(`/me/player`).pipe(
        HttpClientRequest.setUrlParams({
          "market": options?.["market"] as any,
          "additional_types": options?.["additional_types"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CurrentlyPlayingContextObject),
          "401": decodeError(
            "GetInformationAboutTheUsersCurrentPlayback401",
            GetInformationAboutTheUsersCurrentPlayback401
          ),
          "403": decodeError(
            "GetInformationAboutTheUsersCurrentPlayback403",
            GetInformationAboutTheUsersCurrentPlayback403
          ),
          "429": decodeError(
            "GetInformationAboutTheUsersCurrentPlayback429",
            GetInformationAboutTheUsersCurrentPlayback429
          ),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "transferAUsersPlayback": (options) =>
      HttpClientRequest.put(`/me/player`).pipe(
        HttpClientRequest.bodyUnsafeJson(options),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("TransferAUsersPlayback401", TransferAUsersPlayback401),
          "403": decodeError("TransferAUsersPlayback403", TransferAUsersPlayback403),
          "429": decodeError("TransferAUsersPlayback429", TransferAUsersPlayback429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "getAUsersAvailableDevices": () =>
      HttpClientRequest.get(`/me/player/devices`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetAUsersAvailableDevices200),
          "401": decodeError("GetAUsersAvailableDevices401", GetAUsersAvailableDevices401),
          "403": decodeError("GetAUsersAvailableDevices403", GetAUsersAvailableDevices403),
          "429": decodeError("GetAUsersAvailableDevices429", GetAUsersAvailableDevices429),
          orElse: unexpectedStatus
        }))
      ),
    "getTheUsersCurrentlyPlayingTrack": (options) =>
      HttpClientRequest.get(`/me/player/currently-playing`).pipe(
        HttpClientRequest.setUrlParams({
          "market": options?.["market"] as any,
          "additional_types": options?.["additional_types"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CurrentlyPlayingContextObject),
          "401": decodeError("GetTheUsersCurrentlyPlayingTrack401", GetTheUsersCurrentlyPlayingTrack401),
          "403": decodeError("GetTheUsersCurrentlyPlayingTrack403", GetTheUsersCurrentlyPlayingTrack403),
          "429": decodeError("GetTheUsersCurrentlyPlayingTrack429", GetTheUsersCurrentlyPlayingTrack429),
          orElse: unexpectedStatus
        }))
      ),
    "startAUsersPlayback": (options) =>
      HttpClientRequest.put(`/me/player/play`).pipe(
        HttpClientRequest.setUrlParams({ "device_id": options.params?.["device_id"] as any }),
        HttpClientRequest.bodyUnsafeJson(options.payload),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("StartAUsersPlayback401", StartAUsersPlayback401),
          "403": decodeError("StartAUsersPlayback403", StartAUsersPlayback403),
          "429": decodeError("StartAUsersPlayback429", StartAUsersPlayback429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "pauseAUsersPlayback": (options) =>
      HttpClientRequest.put(`/me/player/pause`).pipe(
        HttpClientRequest.setUrlParams({ "device_id": options?.["device_id"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("PauseAUsersPlayback401", PauseAUsersPlayback401),
          "403": decodeError("PauseAUsersPlayback403", PauseAUsersPlayback403),
          "429": decodeError("PauseAUsersPlayback429", PauseAUsersPlayback429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "skipUsersPlaybackToNextTrack": (options) =>
      HttpClientRequest.post(`/me/player/next`).pipe(
        HttpClientRequest.setUrlParams({ "device_id": options?.["device_id"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("SkipUsersPlaybackToNextTrack401", SkipUsersPlaybackToNextTrack401),
          "403": decodeError("SkipUsersPlaybackToNextTrack403", SkipUsersPlaybackToNextTrack403),
          "429": decodeError("SkipUsersPlaybackToNextTrack429", SkipUsersPlaybackToNextTrack429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "skipUsersPlaybackToPreviousTrack": (options) =>
      HttpClientRequest.post(`/me/player/previous`).pipe(
        HttpClientRequest.setUrlParams({ "device_id": options?.["device_id"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("SkipUsersPlaybackToPreviousTrack401", SkipUsersPlaybackToPreviousTrack401),
          "403": decodeError("SkipUsersPlaybackToPreviousTrack403", SkipUsersPlaybackToPreviousTrack403),
          "429": decodeError("SkipUsersPlaybackToPreviousTrack429", SkipUsersPlaybackToPreviousTrack429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "seekToPositionInCurrentlyPlayingTrack": (options) =>
      HttpClientRequest.put(`/me/player/seek`).pipe(
        HttpClientRequest.setUrlParams({
          "position_ms": options?.["position_ms"] as any,
          "device_id": options?.["device_id"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("SeekToPositionInCurrentlyPlayingTrack401", SeekToPositionInCurrentlyPlayingTrack401),
          "403": decodeError("SeekToPositionInCurrentlyPlayingTrack403", SeekToPositionInCurrentlyPlayingTrack403),
          "429": decodeError("SeekToPositionInCurrentlyPlayingTrack429", SeekToPositionInCurrentlyPlayingTrack429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "setRepeatModeOnUsersPlayback": (options) =>
      HttpClientRequest.put(`/me/player/repeat`).pipe(
        HttpClientRequest.setUrlParams({
          "state": options?.["state"] as any,
          "device_id": options?.["device_id"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("SetRepeatModeOnUsersPlayback401", SetRepeatModeOnUsersPlayback401),
          "403": decodeError("SetRepeatModeOnUsersPlayback403", SetRepeatModeOnUsersPlayback403),
          "429": decodeError("SetRepeatModeOnUsersPlayback429", SetRepeatModeOnUsersPlayback429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "setVolumeForUsersPlayback": (options) =>
      HttpClientRequest.put(`/me/player/volume`).pipe(
        HttpClientRequest.setUrlParams({
          "volume_percent": options?.["volume_percent"] as any,
          "device_id": options?.["device_id"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("SetVolumeForUsersPlayback401", SetVolumeForUsersPlayback401),
          "403": decodeError("SetVolumeForUsersPlayback403", SetVolumeForUsersPlayback403),
          "429": decodeError("SetVolumeForUsersPlayback429", SetVolumeForUsersPlayback429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "toggleShuffleForUsersPlayback": (options) =>
      HttpClientRequest.put(`/me/player/shuffle`).pipe(
        HttpClientRequest.setUrlParams({
          "state": options?.["state"] as any,
          "device_id": options?.["device_id"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "401": decodeError("ToggleShuffleForUsersPlayback401", ToggleShuffleForUsersPlayback401),
          "403": decodeError("ToggleShuffleForUsersPlayback403", ToggleShuffleForUsersPlayback403),
          "429": decodeError("ToggleShuffleForUsersPlayback429", ToggleShuffleForUsersPlayback429),
          "204": () => Effect.void,
          orElse: unexpectedStatus
        }))
      ),
    "getRecentlyPlayed": (options) =>
      HttpClientRequest.get(`/me/player/recently-played`).pipe(
        HttpClientRequest.setUrlParams({
          "limit": options?.["limit"] as any,
          "after": options?.["after"] as any,
          "before": options?.["before"] as any
        }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(CursorPagingPlayHistoryObject),
          "401": decodeError("GetRecentlyPlayed401", GetRecentlyPlayed401),
          "403": decodeError("GetRecentlyPlayed403", GetRecentlyPlayed403),
          "429": decodeError("GetRecentlyPlayed429", GetRecentlyPlayed429),
          orElse: unexpectedStatus
        }))
      ),
    "getQueue": () =>
      HttpClientRequest.get(`/me/player/queue`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(QueueObject),
          "401": decodeError("GetQueue401", GetQueue401),
          "403": decodeError("GetQueue403", GetQueue403),
          "429": decodeError("GetQueue429", GetQueue429),
          orElse: unexpectedStatus
        }))
      ),
    "addToQueue": (options) =>
      HttpClientRequest.post(`/me/player/queue`).pipe(
        HttpClientRequest.setUrlParams({ "uri": options?.["uri"] as any, "device_id": options?.["device_id"] as any }),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": () => Effect.void,
          "401": decodeError("AddToQueue401", AddToQueue401),
          "403": decodeError("AddToQueue403", AddToQueue403),
          "429": decodeError("AddToQueue429", AddToQueue429),
          orElse: unexpectedStatus
        }))
      ),
    "getAvailableMarkets": () =>
      HttpClientRequest.get(`/markets`).pipe(
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(GetAvailableMarkets200),
          "401": decodeError("GetAvailableMarkets401", GetAvailableMarkets401),
          "403": decodeError("GetAvailableMarkets403", GetAvailableMarkets403),
          "429": decodeError("GetAvailableMarkets429", GetAvailableMarkets429),
          orElse: unexpectedStatus
        }))
      )
  }
}

export interface Client {
  readonly httpClient: HttpClient.HttpClient
  /**
   * Get Spotify catalog information for a single album.
   */
  readonly "getAnAlbum": (
    id: string,
    options?: typeof GetAnAlbumParams.Encoded | undefined
  ) => Effect.Effect<
    typeof AlbumObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAnAlbum401", typeof GetAnAlbum401.Type>
    | ClientError<"GetAnAlbum403", typeof GetAnAlbum403.Type>
    | ClientError<"GetAnAlbum429", typeof GetAnAlbum429.Type>
  >
  /**
   * Get Spotify catalog information for multiple albums identified by their Spotify IDs.
   */
  readonly "getMultipleAlbums": (
    options: typeof GetMultipleAlbumsParams.Encoded
  ) => Effect.Effect<
    typeof GetMultipleAlbums200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetMultipleAlbums401", typeof GetMultipleAlbums401.Type>
    | ClientError<"GetMultipleAlbums403", typeof GetMultipleAlbums403.Type>
    | ClientError<"GetMultipleAlbums429", typeof GetMultipleAlbums429.Type>
  >
  /**
   * Get Spotify catalog information about an album’s tracks.
   * Optional parameters can be used to limit the number of tracks returned.
   */
  readonly "getAnAlbumsTracks": (
    id: string,
    options?: typeof GetAnAlbumsTracksParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingSimplifiedTrackObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAnAlbumsTracks401", typeof GetAnAlbumsTracks401.Type>
    | ClientError<"GetAnAlbumsTracks403", typeof GetAnAlbumsTracks403.Type>
    | ClientError<"GetAnAlbumsTracks429", typeof GetAnAlbumsTracks429.Type>
  >
  /**
   * Get Spotify catalog information for a single artist identified by their unique Spotify ID.
   */
  readonly "getAnArtist": (
    id: string,
    options?: typeof GetAnArtistParams.Encoded | undefined
  ) => Effect.Effect<
    typeof ArtistObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAnArtist401", typeof GetAnArtist401.Type>
    | ClientError<"GetAnArtist403", typeof GetAnArtist403.Type>
    | ClientError<"GetAnArtist429", typeof GetAnArtist429.Type>
  >
  /**
   * Get Spotify catalog information for several artists based on their Spotify IDs.
   */
  readonly "getMultipleArtists": (
    options: typeof GetMultipleArtistsParams.Encoded
  ) => Effect.Effect<
    typeof GetMultipleArtists200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetMultipleArtists401", typeof GetMultipleArtists401.Type>
    | ClientError<"GetMultipleArtists403", typeof GetMultipleArtists403.Type>
    | ClientError<"GetMultipleArtists429", typeof GetMultipleArtists429.Type>
  >
  /**
   * Get Spotify catalog information about an artist's albums.
   */
  readonly "getAnArtistsAlbums": (
    id: string,
    options?: typeof GetAnArtistsAlbumsParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingArtistDiscographyAlbumObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAnArtistsAlbums401", typeof GetAnArtistsAlbums401.Type>
    | ClientError<"GetAnArtistsAlbums403", typeof GetAnArtistsAlbums403.Type>
    | ClientError<"GetAnArtistsAlbums429", typeof GetAnArtistsAlbums429.Type>
  >
  /**
   * Get Spotify catalog information about an artist's top tracks by country.
   */
  readonly "getAnArtistsTopTracks": (
    id: string,
    options?: typeof GetAnArtistsTopTracksParams.Encoded | undefined
  ) => Effect.Effect<
    typeof GetAnArtistsTopTracks200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAnArtistsTopTracks401", typeof GetAnArtistsTopTracks401.Type>
    | ClientError<"GetAnArtistsTopTracks403", typeof GetAnArtistsTopTracks403.Type>
    | ClientError<"GetAnArtistsTopTracks429", typeof GetAnArtistsTopTracks429.Type>
  >
  /**
   * Get Spotify catalog information about artists similar to a given artist. Similarity is based on analysis of the Spotify community's listening history.
   */
  readonly "getAnArtistsRelatedArtists": (
    id: string,
    options?: typeof GetAnArtistsRelatedArtistsParams.Encoded | undefined
  ) => Effect.Effect<
    typeof GetAnArtistsRelatedArtists200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAnArtistsRelatedArtists401", typeof GetAnArtistsRelatedArtists401.Type>
    | ClientError<"GetAnArtistsRelatedArtists403", typeof GetAnArtistsRelatedArtists403.Type>
    | ClientError<"GetAnArtistsRelatedArtists429", typeof GetAnArtistsRelatedArtists429.Type>
  >
  /**
   * Get Spotify catalog information for a single show identified by its
   * unique Spotify ID.
   */
  readonly "getAShow": (
    id: string,
    options?: typeof GetAShowParams.Encoded | undefined
  ) => Effect.Effect<
    typeof ShowObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAShow401", typeof GetAShow401.Type>
    | ClientError<"GetAShow403", typeof GetAShow403.Type>
    | ClientError<"GetAShow429", typeof GetAShow429.Type>
  >
  /**
   * Get Spotify catalog information for several shows based on their Spotify IDs.
   */
  readonly "getMultipleShows": (
    options: typeof GetMultipleShowsParams.Encoded
  ) => Effect.Effect<
    typeof GetMultipleShows200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetMultipleShows401", typeof GetMultipleShows401.Type>
    | ClientError<"GetMultipleShows403", typeof GetMultipleShows403.Type>
    | ClientError<"GetMultipleShows429", typeof GetMultipleShows429.Type>
  >
  /**
   * Get Spotify catalog information about an show’s episodes. Optional parameters can be used to limit the number of episodes returned.
   */
  readonly "getAShowsEpisodes": (
    id: string,
    options?: typeof GetAShowsEpisodesParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingSimplifiedEpisodeObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAShowsEpisodes401", typeof GetAShowsEpisodes401.Type>
    | ClientError<"GetAShowsEpisodes403", typeof GetAShowsEpisodes403.Type>
    | ClientError<"GetAShowsEpisodes429", typeof GetAShowsEpisodes429.Type>
  >
  /**
   * Get Spotify catalog information for a single episode identified by its
   * unique Spotify ID.
   */
  readonly "getAnEpisode": (
    id: string,
    options?: typeof GetAnEpisodeParams.Encoded | undefined
  ) => Effect.Effect<
    typeof EpisodeObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAnEpisode401", typeof GetAnEpisode401.Type>
    | ClientError<"GetAnEpisode403", typeof GetAnEpisode403.Type>
    | ClientError<"GetAnEpisode429", typeof GetAnEpisode429.Type>
  >
  /**
   * Get Spotify catalog information for several episodes based on their Spotify IDs.
   */
  readonly "getMultipleEpisodes": (
    options: typeof GetMultipleEpisodesParams.Encoded
  ) => Effect.Effect<
    typeof GetMultipleEpisodes200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetMultipleEpisodes401", typeof GetMultipleEpisodes401.Type>
    | ClientError<"GetMultipleEpisodes403", typeof GetMultipleEpisodes403.Type>
    | ClientError<"GetMultipleEpisodes429", typeof GetMultipleEpisodes429.Type>
  >
  /**
   * Get Spotify catalog information for a single audiobook. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
   */
  readonly "getAnAudiobook": (
    id: string,
    options?: typeof GetAnAudiobookParams.Encoded | undefined
  ) => Effect.Effect<
    typeof AudiobookObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAnAudiobook400", typeof GetAnAudiobook400.Type>
    | ClientError<"GetAnAudiobook401", typeof GetAnAudiobook401.Type>
    | ClientError<"GetAnAudiobook403", typeof GetAnAudiobook403.Type>
    | ClientError<"GetAnAudiobook404", typeof GetAnAudiobook404.Type>
    | ClientError<"GetAnAudiobook429", typeof GetAnAudiobook429.Type>
  >
  /**
   * Get Spotify catalog information for several audiobooks identified by their Spotify IDs. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
   */
  readonly "getMultipleAudiobooks": (
    options: typeof GetMultipleAudiobooksParams.Encoded
  ) => Effect.Effect<
    typeof GetMultipleAudiobooks200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetMultipleAudiobooks401", typeof GetMultipleAudiobooks401.Type>
    | ClientError<"GetMultipleAudiobooks403", typeof GetMultipleAudiobooks403.Type>
    | ClientError<"GetMultipleAudiobooks429", typeof GetMultipleAudiobooks429.Type>
  >
  /**
   * Get Spotify catalog information about an audiobook's chapters. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
   */
  readonly "getAudiobookChapters": (
    id: string,
    options?: typeof GetAudiobookChaptersParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingSimplifiedChapterObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAudiobookChapters401", typeof GetAudiobookChapters401.Type>
    | ClientError<"GetAudiobookChapters403", typeof GetAudiobookChapters403.Type>
    | ClientError<"GetAudiobookChapters429", typeof GetAudiobookChapters429.Type>
  >
  /**
   * Get a list of the audiobooks saved in the current Spotify user's 'Your Music' library.
   */
  readonly "getUsersSavedAudiobooks": (
    options?: typeof GetUsersSavedAudiobooksParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingSimplifiedAudiobookObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetUsersSavedAudiobooks401", typeof GetUsersSavedAudiobooks401.Type>
    | ClientError<"GetUsersSavedAudiobooks403", typeof GetUsersSavedAudiobooks403.Type>
    | ClientError<"GetUsersSavedAudiobooks429", typeof GetUsersSavedAudiobooks429.Type>
  >
  /**
   * Save one or more audiobooks to the current Spotify user's library.
   */
  readonly "saveAudiobooksUser": (
    options: typeof SaveAudiobooksUserParams.Encoded
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"SaveAudiobooksUser401", typeof SaveAudiobooksUser401.Type>
    | ClientError<"SaveAudiobooksUser403", typeof SaveAudiobooksUser403.Type>
    | ClientError<"SaveAudiobooksUser429", typeof SaveAudiobooksUser429.Type>
  >
  /**
   * Remove one or more audiobooks from the Spotify user's library.
   */
  readonly "removeAudiobooksUser": (
    options: typeof RemoveAudiobooksUserParams.Encoded
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"RemoveAudiobooksUser401", typeof RemoveAudiobooksUser401.Type>
    | ClientError<"RemoveAudiobooksUser403", typeof RemoveAudiobooksUser403.Type>
    | ClientError<"RemoveAudiobooksUser429", typeof RemoveAudiobooksUser429.Type>
  >
  /**
   * Check if one or more audiobooks are already saved in the current Spotify user's library.
   */
  readonly "checkUsersSavedAudiobooks": (
    options: typeof CheckUsersSavedAudiobooksParams.Encoded
  ) => Effect.Effect<
    typeof CheckUsersSavedAudiobooks200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"CheckUsersSavedAudiobooks401", typeof CheckUsersSavedAudiobooks401.Type>
    | ClientError<"CheckUsersSavedAudiobooks403", typeof CheckUsersSavedAudiobooks403.Type>
    | ClientError<"CheckUsersSavedAudiobooks429", typeof CheckUsersSavedAudiobooks429.Type>
  >
  /**
   * Get Spotify catalog information for a single audiobook chapter. Chapters are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
   */
  readonly "getAChapter": (
    id: string,
    options?: typeof GetAChapterParams.Encoded | undefined
  ) => Effect.Effect<
    typeof ChapterObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAChapter401", typeof GetAChapter401.Type>
    | ClientError<"GetAChapter403", typeof GetAChapter403.Type>
    | ClientError<"GetAChapter429", typeof GetAChapter429.Type>
  >
  /**
   * Get Spotify catalog information for several audiobook chapters identified by their Spotify IDs. Chapters are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
   */
  readonly "getSeveralChapters": (
    options: typeof GetSeveralChaptersParams.Encoded
  ) => Effect.Effect<
    typeof GetSeveralChapters200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetSeveralChapters401", typeof GetSeveralChapters401.Type>
    | ClientError<"GetSeveralChapters403", typeof GetSeveralChapters403.Type>
    | ClientError<"GetSeveralChapters429", typeof GetSeveralChapters429.Type>
  >
  /**
   * Get Spotify catalog information for a single track identified by its
   * unique Spotify ID.
   */
  readonly "getTrack": (
    id: string,
    options?: typeof GetTrackParams.Encoded | undefined
  ) => Effect.Effect<
    typeof TrackObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetTrack401", typeof GetTrack401.Type>
    | ClientError<"GetTrack403", typeof GetTrack403.Type>
    | ClientError<"GetTrack429", typeof GetTrack429.Type>
  >
  /**
   * Get Spotify catalog information for multiple tracks based on their Spotify IDs.
   */
  readonly "getSeveralTracks": (
    options: typeof GetSeveralTracksParams.Encoded
  ) => Effect.Effect<
    typeof GetSeveralTracks200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetSeveralTracks401", typeof GetSeveralTracks401.Type>
    | ClientError<"GetSeveralTracks403", typeof GetSeveralTracks403.Type>
    | ClientError<"GetSeveralTracks429", typeof GetSeveralTracks429.Type>
  >
  /**
   * Get Spotify catalog information about albums, artists, playlists, tracks, shows, episodes or audiobooks
   * that match a keyword string. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
   */
  readonly "search": (
    options: typeof SearchParams.Encoded
  ) => Effect.Effect<
    typeof Search200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"Search401", typeof Search401.Type>
    | ClientError<"Search403", typeof Search403.Type>
    | ClientError<"Search429", typeof Search429.Type>
  >
  /**
   * Get detailed profile information about the current user (including the
   * current user's username).
   */
  readonly "getCurrentUsersProfile": () => Effect.Effect<
    typeof PrivateUserObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetCurrentUsersProfile401", typeof GetCurrentUsersProfile401.Type>
    | ClientError<"GetCurrentUsersProfile403", typeof GetCurrentUsersProfile403.Type>
    | ClientError<"GetCurrentUsersProfile429", typeof GetCurrentUsersProfile429.Type>
  >
  /**
   * Get a playlist owned by a Spotify user.
   */
  readonly "getPlaylist": (
    playlistId: string,
    options?: typeof GetPlaylistParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PlaylistObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetPlaylist401", typeof GetPlaylist401.Type>
    | ClientError<"GetPlaylist403", typeof GetPlaylist403.Type>
    | ClientError<"GetPlaylist429", typeof GetPlaylist429.Type>
  >
  /**
   * Change a playlist's name and public/private state. (The user must, of
   * course, own the playlist.)
   */
  readonly "changePlaylistDetails": (
    playlistId: string,
    options: {
      readonly params?: typeof ChangePlaylistDetailsParams.Encoded | undefined
      readonly payload: typeof ChangePlaylistDetailsRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"ChangePlaylistDetails401", typeof ChangePlaylistDetails401.Type>
    | ClientError<"ChangePlaylistDetails403", typeof ChangePlaylistDetails403.Type>
    | ClientError<"ChangePlaylistDetails429", typeof ChangePlaylistDetails429.Type>
  >
  /**
   * Get full details of the items of a playlist owned by a Spotify user.
   */
  readonly "getPlaylistsTracks": (
    playlistId: string,
    options?: typeof GetPlaylistsTracksParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingPlaylistTrackObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetPlaylistsTracks401", typeof GetPlaylistsTracks401.Type>
    | ClientError<"GetPlaylistsTracks403", typeof GetPlaylistsTracks403.Type>
    | ClientError<"GetPlaylistsTracks429", typeof GetPlaylistsTracks429.Type>
  >
  /**
   * Either reorder or replace items in a playlist depending on the request's parameters.
   * To reorder items, include `range_start`, `insert_before`, `range_length` and `snapshot_id` in the request's body.
   * To replace items, include `uris` as either a query parameter or in the request's body.
   * Replacing items in a playlist will overwrite its existing items. This operation can be used for replacing or clearing items in a playlist.
   * <br/>
   * **Note**: Replace and reorder are mutually exclusive operations which share the same endpoint, but have different parameters.
   * These operations can't be applied together in a single request.
   */
  readonly "reorderOrReplacePlaylistsTracks": (
    playlistId: string,
    options: {
      readonly params?: typeof ReorderOrReplacePlaylistsTracksParams.Encoded | undefined
      readonly payload: typeof ReorderOrReplacePlaylistsTracksRequest.Encoded
    }
  ) => Effect.Effect<
    typeof ReorderOrReplacePlaylistsTracks200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"ReorderOrReplacePlaylistsTracks401", typeof ReorderOrReplacePlaylistsTracks401.Type>
    | ClientError<"ReorderOrReplacePlaylistsTracks403", typeof ReorderOrReplacePlaylistsTracks403.Type>
    | ClientError<"ReorderOrReplacePlaylistsTracks429", typeof ReorderOrReplacePlaylistsTracks429.Type>
  >
  /**
   * Add one or more items to a user's playlist.
   */
  readonly "addTracksToPlaylist": (
    playlistId: string,
    options: {
      readonly params?: typeof AddTracksToPlaylistParams.Encoded | undefined
      readonly payload: typeof AddTracksToPlaylistRequest.Encoded
    }
  ) => Effect.Effect<
    typeof AddTracksToPlaylist201.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"AddTracksToPlaylist401", typeof AddTracksToPlaylist401.Type>
    | ClientError<"AddTracksToPlaylist403", typeof AddTracksToPlaylist403.Type>
    | ClientError<"AddTracksToPlaylist429", typeof AddTracksToPlaylist429.Type>
  >
  /**
   * Remove one or more items from a user's playlist.
   */
  readonly "removeTracksPlaylist": (
    playlistId: string,
    options: {
      readonly params?: typeof RemoveTracksPlaylistParams.Encoded | undefined
      readonly payload: typeof RemoveTracksPlaylistRequest.Encoded
    }
  ) => Effect.Effect<
    typeof RemoveTracksPlaylist200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"RemoveTracksPlaylist401", typeof RemoveTracksPlaylist401.Type>
    | ClientError<"RemoveTracksPlaylist403", typeof RemoveTracksPlaylist403.Type>
    | ClientError<"RemoveTracksPlaylist429", typeof RemoveTracksPlaylist429.Type>
  >
  /**
   * Get a list of the playlists owned or followed by the current Spotify
   * user.
   */
  readonly "getAListOfCurrentUsersPlaylists": (
    options?: typeof GetAListOfCurrentUsersPlaylistsParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingPlaylistObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAListOfCurrentUsersPlaylists401", typeof GetAListOfCurrentUsersPlaylists401.Type>
    | ClientError<"GetAListOfCurrentUsersPlaylists403", typeof GetAListOfCurrentUsersPlaylists403.Type>
    | ClientError<"GetAListOfCurrentUsersPlaylists429", typeof GetAListOfCurrentUsersPlaylists429.Type>
  >
  /**
   * Get a list of the albums saved in the current Spotify user's 'Your Music' library.
   */
  readonly "getUsersSavedAlbums": (
    options?: typeof GetUsersSavedAlbumsParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingSavedAlbumObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetUsersSavedAlbums401", typeof GetUsersSavedAlbums401.Type>
    | ClientError<"GetUsersSavedAlbums403", typeof GetUsersSavedAlbums403.Type>
    | ClientError<"GetUsersSavedAlbums429", typeof GetUsersSavedAlbums429.Type>
  >
  /**
   * Save one or more albums to the current user's 'Your Music' library.
   */
  readonly "saveAlbumsUser": (
    options: {
      readonly params: typeof SaveAlbumsUserParams.Encoded
      readonly payload: typeof SaveAlbumsUserRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"SaveAlbumsUser401", typeof SaveAlbumsUser401.Type>
    | ClientError<"SaveAlbumsUser403", typeof SaveAlbumsUser403.Type>
    | ClientError<"SaveAlbumsUser429", typeof SaveAlbumsUser429.Type>
  >
  /**
   * Remove one or more albums from the current user's 'Your Music' library.
   */
  readonly "removeAlbumsUser": (
    options: {
      readonly params: typeof RemoveAlbumsUserParams.Encoded
      readonly payload: typeof RemoveAlbumsUserRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"RemoveAlbumsUser401", typeof RemoveAlbumsUser401.Type>
    | ClientError<"RemoveAlbumsUser403", typeof RemoveAlbumsUser403.Type>
    | ClientError<"RemoveAlbumsUser429", typeof RemoveAlbumsUser429.Type>
  >
  /**
   * Check if one or more albums is already saved in the current Spotify user's 'Your Music' library.
   */
  readonly "checkUsersSavedAlbums": (
    options: typeof CheckUsersSavedAlbumsParams.Encoded
  ) => Effect.Effect<
    typeof CheckUsersSavedAlbums200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"CheckUsersSavedAlbums401", typeof CheckUsersSavedAlbums401.Type>
    | ClientError<"CheckUsersSavedAlbums403", typeof CheckUsersSavedAlbums403.Type>
    | ClientError<"CheckUsersSavedAlbums429", typeof CheckUsersSavedAlbums429.Type>
  >
  /**
   * Get a list of the songs saved in the current Spotify user's 'Your Music' library.
   */
  readonly "getUsersSavedTracks": (
    options?: typeof GetUsersSavedTracksParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingSavedTrackObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetUsersSavedTracks401", typeof GetUsersSavedTracks401.Type>
    | ClientError<"GetUsersSavedTracks403", typeof GetUsersSavedTracks403.Type>
    | ClientError<"GetUsersSavedTracks429", typeof GetUsersSavedTracks429.Type>
  >
  /**
   * Save one or more tracks to the current user's 'Your Music' library.
   */
  readonly "saveTracksUser": (
    options: {
      readonly params: typeof SaveTracksUserParams.Encoded
      readonly payload: typeof SaveTracksUserRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"SaveTracksUser401", typeof SaveTracksUser401.Type>
    | ClientError<"SaveTracksUser403", typeof SaveTracksUser403.Type>
    | ClientError<"SaveTracksUser429", typeof SaveTracksUser429.Type>
  >
  /**
   * Remove one or more tracks from the current user's 'Your Music' library.
   */
  readonly "removeTracksUser": (
    options: {
      readonly params: typeof RemoveTracksUserParams.Encoded
      readonly payload: typeof RemoveTracksUserRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"RemoveTracksUser401", typeof RemoveTracksUser401.Type>
    | ClientError<"RemoveTracksUser403", typeof RemoveTracksUser403.Type>
    | ClientError<"RemoveTracksUser429", typeof RemoveTracksUser429.Type>
  >
  /**
   * Check if one or more tracks is already saved in the current Spotify user's 'Your Music' library.
   */
  readonly "checkUsersSavedTracks": (
    options: typeof CheckUsersSavedTracksParams.Encoded
  ) => Effect.Effect<
    typeof CheckUsersSavedTracks200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"CheckUsersSavedTracks401", typeof CheckUsersSavedTracks401.Type>
    | ClientError<"CheckUsersSavedTracks403", typeof CheckUsersSavedTracks403.Type>
    | ClientError<"CheckUsersSavedTracks429", typeof CheckUsersSavedTracks429.Type>
  >
  /**
   * Get a list of the episodes saved in the current Spotify user's library.<br/>
   * This API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer).
   */
  readonly "getUsersSavedEpisodes": (
    options?: typeof GetUsersSavedEpisodesParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingSavedEpisodeObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetUsersSavedEpisodes401", typeof GetUsersSavedEpisodes401.Type>
    | ClientError<"GetUsersSavedEpisodes403", typeof GetUsersSavedEpisodes403.Type>
    | ClientError<"GetUsersSavedEpisodes429", typeof GetUsersSavedEpisodes429.Type>
  >
  /**
   * Save one or more episodes to the current user's library.<br/>
   * This API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer).
   */
  readonly "saveEpisodesUser": (
    options: {
      readonly params: typeof SaveEpisodesUserParams.Encoded
      readonly payload: typeof SaveEpisodesUserRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"SaveEpisodesUser401", typeof SaveEpisodesUser401.Type>
    | ClientError<"SaveEpisodesUser403", typeof SaveEpisodesUser403.Type>
    | ClientError<"SaveEpisodesUser429", typeof SaveEpisodesUser429.Type>
  >
  /**
   * Remove one or more episodes from the current user's library.<br/>
   * This API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer).
   */
  readonly "removeEpisodesUser": (
    options: {
      readonly params: typeof RemoveEpisodesUserParams.Encoded
      readonly payload: typeof RemoveEpisodesUserRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"RemoveEpisodesUser401", typeof RemoveEpisodesUser401.Type>
    | ClientError<"RemoveEpisodesUser403", typeof RemoveEpisodesUser403.Type>
    | ClientError<"RemoveEpisodesUser429", typeof RemoveEpisodesUser429.Type>
  >
  /**
   * Check if one or more episodes is already saved in the current Spotify user's 'Your Episodes' library.<br/>
   * This API endpoint is in __beta__ and could change without warning. Please share any feedback that you have, or issues that you discover, in our [developer community forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer)..
   */
  readonly "checkUsersSavedEpisodes": (
    options: typeof CheckUsersSavedEpisodesParams.Encoded
  ) => Effect.Effect<
    typeof CheckUsersSavedEpisodes200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"CheckUsersSavedEpisodes401", typeof CheckUsersSavedEpisodes401.Type>
    | ClientError<"CheckUsersSavedEpisodes403", typeof CheckUsersSavedEpisodes403.Type>
    | ClientError<"CheckUsersSavedEpisodes429", typeof CheckUsersSavedEpisodes429.Type>
  >
  /**
   * Get a list of shows saved in the current Spotify user's library. Optional parameters can be used to limit the number of shows returned.
   */
  readonly "getUsersSavedShows": (
    options?: typeof GetUsersSavedShowsParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingSavedShowObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetUsersSavedShows401", typeof GetUsersSavedShows401.Type>
    | ClientError<"GetUsersSavedShows403", typeof GetUsersSavedShows403.Type>
    | ClientError<"GetUsersSavedShows429", typeof GetUsersSavedShows429.Type>
  >
  /**
   * Save one or more shows to current Spotify user's library.
   */
  readonly "saveShowsUser": (
    options: typeof SaveShowsUserParams.Encoded
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"SaveShowsUser401", typeof SaveShowsUser401.Type>
    | ClientError<"SaveShowsUser403", typeof SaveShowsUser403.Type>
    | ClientError<"SaveShowsUser429", typeof SaveShowsUser429.Type>
  >
  /**
   * Delete one or more shows from current Spotify user's library.
   */
  readonly "removeShowsUser": (
    options: typeof RemoveShowsUserParams.Encoded
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"RemoveShowsUser401", typeof RemoveShowsUser401.Type>
    | ClientError<"RemoveShowsUser403", typeof RemoveShowsUser403.Type>
    | ClientError<"RemoveShowsUser429", typeof RemoveShowsUser429.Type>
  >
  /**
   * Check if one or more shows is already saved in the current Spotify user's library.
   */
  readonly "checkUsersSavedShows": (
    options: typeof CheckUsersSavedShowsParams.Encoded
  ) => Effect.Effect<
    typeof CheckUsersSavedShows200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"CheckUsersSavedShows401", typeof CheckUsersSavedShows401.Type>
    | ClientError<"CheckUsersSavedShows403", typeof CheckUsersSavedShows403.Type>
    | ClientError<"CheckUsersSavedShows429", typeof CheckUsersSavedShows429.Type>
  >
  /**
   * Get the current user's top artists or tracks based on calculated affinity.
   */
  readonly "getUsersTopArtistsAndTracks": (
    type: string,
    options?: typeof GetUsersTopArtistsAndTracksParams.Encoded | undefined
  ) => Effect.Effect<
    typeof GetUsersTopArtistsAndTracks200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetUsersTopArtistsAndTracks401", typeof GetUsersTopArtistsAndTracks401.Type>
    | ClientError<"GetUsersTopArtistsAndTracks403", typeof GetUsersTopArtistsAndTracks403.Type>
    | ClientError<"GetUsersTopArtistsAndTracks429", typeof GetUsersTopArtistsAndTracks429.Type>
  >
  /**
   * Get public profile information about a Spotify user.
   */
  readonly "getUsersProfile": (
    userId: string,
    options?: typeof GetUsersProfileParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PublicUserObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetUsersProfile401", typeof GetUsersProfile401.Type>
    | ClientError<"GetUsersProfile403", typeof GetUsersProfile403.Type>
    | ClientError<"GetUsersProfile429", typeof GetUsersProfile429.Type>
  >
  /**
   * Get a list of the playlists owned or followed by a Spotify user.
   */
  readonly "getListUsersPlaylists": (
    userId: string,
    options?: typeof GetListUsersPlaylistsParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingPlaylistObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetListUsersPlaylists401", typeof GetListUsersPlaylists401.Type>
    | ClientError<"GetListUsersPlaylists403", typeof GetListUsersPlaylists403.Type>
    | ClientError<"GetListUsersPlaylists429", typeof GetListUsersPlaylists429.Type>
  >
  /**
   * Create a playlist for a Spotify user. (The playlist will be empty until
   * you [add tracks](/documentation/web-api/reference/add-tracks-to-playlist).)
   * Each user is generally limited to a maximum of 11000 playlists.
   */
  readonly "createPlaylist": (
    userId: string,
    options: {
      readonly params?: typeof CreatePlaylistParams.Encoded | undefined
      readonly payload: typeof CreatePlaylistRequest.Encoded
    }
  ) => Effect.Effect<
    typeof PlaylistObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"CreatePlaylist401", typeof CreatePlaylist401.Type>
    | ClientError<"CreatePlaylist403", typeof CreatePlaylist403.Type>
    | ClientError<"CreatePlaylist429", typeof CreatePlaylist429.Type>
  >
  /**
   * Add the current user as a follower of a playlist.
   */
  readonly "followPlaylist": (
    playlistId: string,
    options: {
      readonly params?: typeof FollowPlaylistParams.Encoded | undefined
      readonly payload: typeof FollowPlaylistRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"FollowPlaylist401", typeof FollowPlaylist401.Type>
    | ClientError<"FollowPlaylist403", typeof FollowPlaylist403.Type>
    | ClientError<"FollowPlaylist429", typeof FollowPlaylist429.Type>
  >
  /**
   * Remove the current user as a follower of a playlist.
   */
  readonly "unfollowPlaylist": (
    playlistId: string,
    options?: typeof UnfollowPlaylistParams.Encoded | undefined
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"UnfollowPlaylist401", typeof UnfollowPlaylist401.Type>
    | ClientError<"UnfollowPlaylist403", typeof UnfollowPlaylist403.Type>
    | ClientError<"UnfollowPlaylist429", typeof UnfollowPlaylist429.Type>
  >
  /**
   * Get a list of Spotify featured playlists (shown, for example, on a Spotify player's 'Browse' tab).
   */
  readonly "getFeaturedPlaylists": (
    options?: typeof GetFeaturedPlaylistsParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingFeaturedPlaylistObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetFeaturedPlaylists401", typeof GetFeaturedPlaylists401.Type>
    | ClientError<"GetFeaturedPlaylists403", typeof GetFeaturedPlaylists403.Type>
    | ClientError<"GetFeaturedPlaylists429", typeof GetFeaturedPlaylists429.Type>
  >
  /**
   * Get a list of categories used to tag items in Spotify (on, for example, the Spotify player’s “Browse” tab).
   */
  readonly "getCategories": (
    options?: typeof GetCategoriesParams.Encoded | undefined
  ) => Effect.Effect<
    typeof GetCategories200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetCategories401", typeof GetCategories401.Type>
    | ClientError<"GetCategories403", typeof GetCategories403.Type>
    | ClientError<"GetCategories429", typeof GetCategories429.Type>
  >
  /**
   * Get a single category used to tag items in Spotify (on, for example, the Spotify player’s “Browse” tab).
   */
  readonly "getACategory": (
    categoryId: string,
    options?: typeof GetACategoryParams.Encoded | undefined
  ) => Effect.Effect<
    typeof CategoryObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetACategory401", typeof GetACategory401.Type>
    | ClientError<"GetACategory403", typeof GetACategory403.Type>
    | ClientError<"GetACategory429", typeof GetACategory429.Type>
  >
  /**
   * Get a list of Spotify playlists tagged with a particular category.
   */
  readonly "getACategoriesPlaylists": (
    categoryId: string,
    options?: typeof GetACategoriesPlaylistsParams.Encoded | undefined
  ) => Effect.Effect<
    typeof PagingFeaturedPlaylistObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetACategoriesPlaylists401", typeof GetACategoriesPlaylists401.Type>
    | ClientError<"GetACategoriesPlaylists403", typeof GetACategoriesPlaylists403.Type>
    | ClientError<"GetACategoriesPlaylists429", typeof GetACategoriesPlaylists429.Type>
  >
  /**
   * Get the current image associated with a specific playlist.
   */
  readonly "getPlaylistCover": (
    playlistId: string,
    options?: typeof GetPlaylistCoverParams.Encoded | undefined
  ) => Effect.Effect<
    typeof GetPlaylistCover200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetPlaylistCover401", typeof GetPlaylistCover401.Type>
    | ClientError<"GetPlaylistCover403", typeof GetPlaylistCover403.Type>
    | ClientError<"GetPlaylistCover429", typeof GetPlaylistCover429.Type>
  >
  /**
   * Replace the image used to represent a specific playlist.
   */
  readonly "uploadCustomPlaylistCover": (
    playlistId: string,
    options?: typeof UploadCustomPlaylistCoverParams.Encoded | undefined
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"UploadCustomPlaylistCover401", typeof UploadCustomPlaylistCover401.Type>
    | ClientError<"UploadCustomPlaylistCover403", typeof UploadCustomPlaylistCover403.Type>
    | ClientError<"UploadCustomPlaylistCover429", typeof UploadCustomPlaylistCover429.Type>
  >
  /**
   * Get a list of new album releases featured in Spotify (shown, for example, on a Spotify player’s “Browse” tab).
   */
  readonly "getNewReleases": (
    options?: typeof GetNewReleasesParams.Encoded | undefined
  ) => Effect.Effect<
    typeof GetNewReleases200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetNewReleases401", typeof GetNewReleases401.Type>
    | ClientError<"GetNewReleases403", typeof GetNewReleases403.Type>
    | ClientError<"GetNewReleases429", typeof GetNewReleases429.Type>
  >
  /**
   * Get the current user's followed artists.
   */
  readonly "getFollowed": (
    options: typeof GetFollowedParams.Encoded
  ) => Effect.Effect<
    typeof GetFollowed200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetFollowed401", typeof GetFollowed401.Type>
    | ClientError<"GetFollowed403", typeof GetFollowed403.Type>
    | ClientError<"GetFollowed429", typeof GetFollowed429.Type>
  >
  /**
   * Add the current user as a follower of one or more artists or other Spotify users.
   */
  readonly "followArtistsUsers": (
    options: {
      readonly params: typeof FollowArtistsUsersParams.Encoded
      readonly payload: typeof FollowArtistsUsersRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"FollowArtistsUsers401", typeof FollowArtistsUsers401.Type>
    | ClientError<"FollowArtistsUsers403", typeof FollowArtistsUsers403.Type>
    | ClientError<"FollowArtistsUsers429", typeof FollowArtistsUsers429.Type>
  >
  /**
   * Remove the current user as a follower of one or more artists or other Spotify users.
   */
  readonly "unfollowArtistsUsers": (
    options: {
      readonly params: typeof UnfollowArtistsUsersParams.Encoded
      readonly payload: typeof UnfollowArtistsUsersRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"UnfollowArtistsUsers401", typeof UnfollowArtistsUsers401.Type>
    | ClientError<"UnfollowArtistsUsers403", typeof UnfollowArtistsUsers403.Type>
    | ClientError<"UnfollowArtistsUsers429", typeof UnfollowArtistsUsers429.Type>
  >
  /**
   * Check to see if the current user is following one or more artists or other Spotify users.
   */
  readonly "checkCurrentUserFollows": (
    options: typeof CheckCurrentUserFollowsParams.Encoded
  ) => Effect.Effect<
    typeof CheckCurrentUserFollows200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"CheckCurrentUserFollows401", typeof CheckCurrentUserFollows401.Type>
    | ClientError<"CheckCurrentUserFollows403", typeof CheckCurrentUserFollows403.Type>
    | ClientError<"CheckCurrentUserFollows429", typeof CheckCurrentUserFollows429.Type>
  >
  /**
   * Check to see if the current user is following a specified playlist.
   */
  readonly "checkIfUserFollowsPlaylist": (
    playlistId: string,
    options?: typeof CheckIfUserFollowsPlaylistParams.Encoded | undefined
  ) => Effect.Effect<
    typeof CheckIfUserFollowsPlaylist200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"CheckIfUserFollowsPlaylist401", typeof CheckIfUserFollowsPlaylist401.Type>
    | ClientError<"CheckIfUserFollowsPlaylist403", typeof CheckIfUserFollowsPlaylist403.Type>
    | ClientError<"CheckIfUserFollowsPlaylist429", typeof CheckIfUserFollowsPlaylist429.Type>
  >
  /**
   * Get audio features for multiple tracks based on their Spotify IDs.
   */
  readonly "getSeveralAudioFeatures": (
    options: typeof GetSeveralAudioFeaturesParams.Encoded
  ) => Effect.Effect<
    typeof GetSeveralAudioFeatures200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetSeveralAudioFeatures401", typeof GetSeveralAudioFeatures401.Type>
    | ClientError<"GetSeveralAudioFeatures403", typeof GetSeveralAudioFeatures403.Type>
    | ClientError<"GetSeveralAudioFeatures429", typeof GetSeveralAudioFeatures429.Type>
  >
  /**
   * Get audio feature information for a single track identified by its unique
   * Spotify ID.
   */
  readonly "getAudioFeatures": (
    id: string
  ) => Effect.Effect<
    typeof AudioFeaturesObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAudioFeatures401", typeof GetAudioFeatures401.Type>
    | ClientError<"GetAudioFeatures403", typeof GetAudioFeatures403.Type>
    | ClientError<"GetAudioFeatures429", typeof GetAudioFeatures429.Type>
  >
  /**
   * Get a low-level audio analysis for a track in the Spotify catalog. The audio analysis describes the track’s structure and musical content, including rhythm, pitch, and timbre.
   */
  readonly "getAudioAnalysis": (
    id: string
  ) => Effect.Effect<
    typeof AudioAnalysisObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAudioAnalysis401", typeof GetAudioAnalysis401.Type>
    | ClientError<"GetAudioAnalysis403", typeof GetAudioAnalysis403.Type>
    | ClientError<"GetAudioAnalysis429", typeof GetAudioAnalysis429.Type>
  >
  /**
   * Recommendations are generated based on the available information for a given seed entity and matched against similar artists and tracks. If there is sufficient information about the provided seeds, a list of tracks will be returned together with pool size details.
   *
   * For artists and tracks that are very new or obscure there might not be enough data to generate a list of tracks.
   */
  readonly "getRecommendations": (
    options: typeof GetRecommendationsParams.Encoded
  ) => Effect.Effect<
    typeof RecommendationsObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetRecommendations401", typeof GetRecommendations401.Type>
    | ClientError<"GetRecommendations403", typeof GetRecommendations403.Type>
    | ClientError<"GetRecommendations429", typeof GetRecommendations429.Type>
  >
  /**
   * Retrieve a list of available genres seed parameter values for [recommendations](/documentation/web-api/reference/get-recommendations).
   */
  readonly "getRecommendationGenres": () => Effect.Effect<
    typeof GetRecommendationGenres200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetRecommendationGenres401", typeof GetRecommendationGenres401.Type>
    | ClientError<"GetRecommendationGenres403", typeof GetRecommendationGenres403.Type>
    | ClientError<"GetRecommendationGenres429", typeof GetRecommendationGenres429.Type>
  >
  /**
   * Get information about the user’s current playback state, including track or episode, progress, and active device.
   */
  readonly "getInformationAboutTheUsersCurrentPlayback": (
    options?: typeof GetInformationAboutTheUsersCurrentPlaybackParams.Encoded | undefined
  ) => Effect.Effect<
    typeof CurrentlyPlayingContextObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<
      "GetInformationAboutTheUsersCurrentPlayback401",
      typeof GetInformationAboutTheUsersCurrentPlayback401.Type
    >
    | ClientError<
      "GetInformationAboutTheUsersCurrentPlayback403",
      typeof GetInformationAboutTheUsersCurrentPlayback403.Type
    >
    | ClientError<
      "GetInformationAboutTheUsersCurrentPlayback429",
      typeof GetInformationAboutTheUsersCurrentPlayback429.Type
    >
  >
  /**
   * Transfer playback to a new device and optionally begin playback. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
   */
  readonly "transferAUsersPlayback": (
    options: typeof TransferAUsersPlaybackRequest.Encoded
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"TransferAUsersPlayback401", typeof TransferAUsersPlayback401.Type>
    | ClientError<"TransferAUsersPlayback403", typeof TransferAUsersPlayback403.Type>
    | ClientError<"TransferAUsersPlayback429", typeof TransferAUsersPlayback429.Type>
  >
  /**
   * Get information about a user’s available Spotify Connect devices. Some device models are not supported and will not be listed in the API response.
   */
  readonly "getAUsersAvailableDevices": () => Effect.Effect<
    typeof GetAUsersAvailableDevices200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAUsersAvailableDevices401", typeof GetAUsersAvailableDevices401.Type>
    | ClientError<"GetAUsersAvailableDevices403", typeof GetAUsersAvailableDevices403.Type>
    | ClientError<"GetAUsersAvailableDevices429", typeof GetAUsersAvailableDevices429.Type>
  >
  /**
   * Get the object currently being played on the user's Spotify account.
   */
  readonly "getTheUsersCurrentlyPlayingTrack": (
    options?: typeof GetTheUsersCurrentlyPlayingTrackParams.Encoded | undefined
  ) => Effect.Effect<
    typeof CurrentlyPlayingContextObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetTheUsersCurrentlyPlayingTrack401", typeof GetTheUsersCurrentlyPlayingTrack401.Type>
    | ClientError<"GetTheUsersCurrentlyPlayingTrack403", typeof GetTheUsersCurrentlyPlayingTrack403.Type>
    | ClientError<"GetTheUsersCurrentlyPlayingTrack429", typeof GetTheUsersCurrentlyPlayingTrack429.Type>
  >
  /**
   * Start a new context or resume current playback on the user's active device. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
   */
  readonly "startAUsersPlayback": (
    options: {
      readonly params?: typeof StartAUsersPlaybackParams.Encoded | undefined
      readonly payload: typeof StartAUsersPlaybackRequest.Encoded
    }
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"StartAUsersPlayback401", typeof StartAUsersPlayback401.Type>
    | ClientError<"StartAUsersPlayback403", typeof StartAUsersPlayback403.Type>
    | ClientError<"StartAUsersPlayback429", typeof StartAUsersPlayback429.Type>
  >
  /**
   * Pause playback on the user's account. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
   */
  readonly "pauseAUsersPlayback": (
    options?: typeof PauseAUsersPlaybackParams.Encoded | undefined
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"PauseAUsersPlayback401", typeof PauseAUsersPlayback401.Type>
    | ClientError<"PauseAUsersPlayback403", typeof PauseAUsersPlayback403.Type>
    | ClientError<"PauseAUsersPlayback429", typeof PauseAUsersPlayback429.Type>
  >
  /**
   * Skips to next track in the user’s queue. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
   */
  readonly "skipUsersPlaybackToNextTrack": (
    options?: typeof SkipUsersPlaybackToNextTrackParams.Encoded | undefined
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"SkipUsersPlaybackToNextTrack401", typeof SkipUsersPlaybackToNextTrack401.Type>
    | ClientError<"SkipUsersPlaybackToNextTrack403", typeof SkipUsersPlaybackToNextTrack403.Type>
    | ClientError<"SkipUsersPlaybackToNextTrack429", typeof SkipUsersPlaybackToNextTrack429.Type>
  >
  /**
   * Skips to previous track in the user’s queue. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
   */
  readonly "skipUsersPlaybackToPreviousTrack": (
    options?: typeof SkipUsersPlaybackToPreviousTrackParams.Encoded | undefined
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"SkipUsersPlaybackToPreviousTrack401", typeof SkipUsersPlaybackToPreviousTrack401.Type>
    | ClientError<"SkipUsersPlaybackToPreviousTrack403", typeof SkipUsersPlaybackToPreviousTrack403.Type>
    | ClientError<"SkipUsersPlaybackToPreviousTrack429", typeof SkipUsersPlaybackToPreviousTrack429.Type>
  >
  /**
   * Seeks to the given position in the user’s currently playing track. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
   */
  readonly "seekToPositionInCurrentlyPlayingTrack": (
    options: typeof SeekToPositionInCurrentlyPlayingTrackParams.Encoded
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"SeekToPositionInCurrentlyPlayingTrack401", typeof SeekToPositionInCurrentlyPlayingTrack401.Type>
    | ClientError<"SeekToPositionInCurrentlyPlayingTrack403", typeof SeekToPositionInCurrentlyPlayingTrack403.Type>
    | ClientError<"SeekToPositionInCurrentlyPlayingTrack429", typeof SeekToPositionInCurrentlyPlayingTrack429.Type>
  >
  /**
   * Set the repeat mode for the user's playback. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
   */
  readonly "setRepeatModeOnUsersPlayback": (
    options: typeof SetRepeatModeOnUsersPlaybackParams.Encoded
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"SetRepeatModeOnUsersPlayback401", typeof SetRepeatModeOnUsersPlayback401.Type>
    | ClientError<"SetRepeatModeOnUsersPlayback403", typeof SetRepeatModeOnUsersPlayback403.Type>
    | ClientError<"SetRepeatModeOnUsersPlayback429", typeof SetRepeatModeOnUsersPlayback429.Type>
  >
  /**
   * Set the volume for the user’s current playback device. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
   */
  readonly "setVolumeForUsersPlayback": (
    options: typeof SetVolumeForUsersPlaybackParams.Encoded
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"SetVolumeForUsersPlayback401", typeof SetVolumeForUsersPlayback401.Type>
    | ClientError<"SetVolumeForUsersPlayback403", typeof SetVolumeForUsersPlayback403.Type>
    | ClientError<"SetVolumeForUsersPlayback429", typeof SetVolumeForUsersPlayback429.Type>
  >
  /**
   * Toggle shuffle on or off for user’s playback. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
   */
  readonly "toggleShuffleForUsersPlayback": (
    options: typeof ToggleShuffleForUsersPlaybackParams.Encoded
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"ToggleShuffleForUsersPlayback401", typeof ToggleShuffleForUsersPlayback401.Type>
    | ClientError<"ToggleShuffleForUsersPlayback403", typeof ToggleShuffleForUsersPlayback403.Type>
    | ClientError<"ToggleShuffleForUsersPlayback429", typeof ToggleShuffleForUsersPlayback429.Type>
  >
  /**
   * Get tracks from the current user's recently played tracks.
   * _**Note**: Currently doesn't support podcast episodes._
   */
  readonly "getRecentlyPlayed": (
    options?: typeof GetRecentlyPlayedParams.Encoded | undefined
  ) => Effect.Effect<
    typeof CursorPagingPlayHistoryObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetRecentlyPlayed401", typeof GetRecentlyPlayed401.Type>
    | ClientError<"GetRecentlyPlayed403", typeof GetRecentlyPlayed403.Type>
    | ClientError<"GetRecentlyPlayed429", typeof GetRecentlyPlayed429.Type>
  >
  /**
   * Get the list of objects that make up the user's queue.
   */
  readonly "getQueue": () => Effect.Effect<
    typeof QueueObject.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetQueue401", typeof GetQueue401.Type>
    | ClientError<"GetQueue403", typeof GetQueue403.Type>
    | ClientError<"GetQueue429", typeof GetQueue429.Type>
  >
  /**
   * Add an item to be played next in the user's current playback queue. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
   */
  readonly "addToQueue": (
    options: typeof AddToQueueParams.Encoded
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"AddToQueue401", typeof AddToQueue401.Type>
    | ClientError<"AddToQueue403", typeof AddToQueue403.Type>
    | ClientError<"AddToQueue429", typeof AddToQueue429.Type>
  >
  /**
   * Get the list of markets where Spotify is available.
   */
  readonly "getAvailableMarkets": () => Effect.Effect<
    typeof GetAvailableMarkets200.Type,
    | HttpClientError.HttpClientError
    | ParseError
    | ClientError<"GetAvailableMarkets401", typeof GetAvailableMarkets401.Type>
    | ClientError<"GetAvailableMarkets403", typeof GetAvailableMarkets403.Type>
    | ClientError<"GetAvailableMarkets429", typeof GetAvailableMarkets429.Type>
  >
}

export interface ClientError<Tag extends string, E> {
  readonly _tag: Tag
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: HttpClientResponse.HttpClientResponse
  readonly cause: E
}

class ClientErrorImpl extends Data.Error<{
  _tag: string
  cause: any
  request: HttpClientRequest.HttpClientRequest
  response: HttpClientResponse.HttpClientResponse
}> {}

export const ClientError = <Tag extends string, E>(
  tag: Tag,
  cause: E,
  response: HttpClientResponse.HttpClientResponse
): ClientError<Tag, E> =>
  new ClientErrorImpl({
    _tag: tag,
    cause,
    response,
    request: response.request
  }) as any
