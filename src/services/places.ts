import type { PlaceSearchResult } from '../types'

/**
 * Search for a restaurant using Google Places API
 */
export async function searchRestaurant(
  restaurantName: string,
  location: string,
  apiKey: string
): Promise<PlaceSearchResult | null> {
  // Check for dummy credentials
  if (apiKey.startsWith('dummy_')) {
    console.log('[DEMO MODE] Using dummy Google Places API key')
    return {
      place_id: 'demo_place_123',
      name: restaurantName,
      formatted_address: `123 Main St, ${location}`,
      formatted_phone_number: '(555) 123-4567',
      international_phone_number: '+15551234567',
      rating: 4.5,
      user_ratings_total: 1250
    }
  }

  try {
    // Text search to find the restaurant
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    searchUrl.searchParams.set('query', `${restaurantName} ${location}`)
    searchUrl.searchParams.set('key', apiKey)
    
    const searchResponse = await fetch(searchUrl.toString())
    const searchData = await searchResponse.json()
    
    if (!searchData.results || searchData.results.length === 0) {
      console.error('No restaurant found:', restaurantName, location)
      return null
    }
    
    const place = searchData.results[0]
    const placeId = place.place_id
    
    // Get detailed information including phone number
    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    detailsUrl.searchParams.set('place_id', placeId)
    detailsUrl.searchParams.set('fields', 'place_id,name,formatted_address,formatted_phone_number,international_phone_number,rating,user_ratings_total')
    detailsUrl.searchParams.set('key', apiKey)
    
    const detailsResponse = await fetch(detailsUrl.toString())
    const detailsData = await detailsResponse.json()
    
    if (!detailsData.result) {
      console.error('Could not fetch place details')
      return null
    }
    
    return {
      place_id: detailsData.result.place_id,
      name: detailsData.result.name,
      formatted_address: detailsData.result.formatted_address,
      formatted_phone_number: detailsData.result.formatted_phone_number,
      international_phone_number: detailsData.result.international_phone_number,
      rating: detailsData.result.rating,
      user_ratings_total: detailsData.result.user_ratings_total
    }
  } catch (error) {
    console.error('Error searching for restaurant:', error)
    return null
  }
}

/**
 * Extract phone number from place result
 */
export function extractPhoneNumber(place: PlaceSearchResult): string | null {
  // Prefer international format for Twilio
  if (place.international_phone_number) {
    return place.international_phone_number.replace(/\s/g, '')
  }
  
  if (place.formatted_phone_number) {
    // Convert to E.164 format (basic US conversion)
    const digits = place.formatted_phone_number.replace(/\D/g, '')
    if (digits.length === 10) {
      return `+1${digits}`
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    }
    return `+${digits}`
  }
  
  return null
}
