export const faceSwapTemplates = [
  { id: 'hillside', title: 'Hillside escape', src: '/images/examples/hillside-target.webp', result: '/images/examples/hillside-result.webp', width: 736, height: 920, scene: 'A wide landscape with a tilted, forward-looking face.', use: 'Travel edits and captions about taking the long way home.', check: 'Open the target at full size. The face is small compared with the sky, so inspect the eyes before choosing a source.' },
  { id: 'paris', title: 'Paris portrait', src: '/images/examples/paris-target.webp', result: '/images/examples/paris-result.webp', width: 736, height: 1075, scene: 'A portrait with the Eiffel Tower behind the subject.', use: 'A city-break idea or a playful holiday announcement.', check: 'Compare the mouth and head turn with your selfie. Keep the landmark visible when you crop the final result.' },
  { id: 'city', title: 'Café break', src: '/images/examples/city-target.webp', result: '/images/examples/city-result.webp', width: 900, height: 1200, scene: 'A seated portrait in a city café.', use: 'Coffee-break jokes and a relaxed everyday portrait.', check: 'Match the face angle before choosing by outfit. Inspect nearby hair and the jaw against the original.' },
  { id: 'coast', title: 'Coastal afternoon', src: '/images/examples/coast-target.webp', result: '/images/examples/coast-result.webp', width: 784, height: 1372, scene: 'A portrait overlooking the water and coastline.', use: 'A weekend escape or a vacation-day meme.', check: 'Check the transition from face to neck and compare the lighting with your source portrait.' },
  { id: 'woodland', title: 'Woodland glance', src: '/images/examples/woodland-target.webp', result: '/images/examples/woodland-result.webp', width: 737, height: 1319, scene: 'An over-the-shoulder portrait beside trees.', use: 'A looking-back reaction or an outdoor portrait.', check: 'The turned cheek meets a scarf. Choose a source with a compatible head turn and inspect that edge closely.' },
] as const;

export function findFaceSwapTemplate(id: string | undefined) {
  return faceSwapTemplates.find(template => template.id === id);
}
