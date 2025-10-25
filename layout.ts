/**
 * PowerPoint layout configuration
 * All measurements in centimeters
 */

export const layout = {
  // Column positions and widths
  education: {
    x: 1.9,   // Left position of education column
    w: 10.02  // Width of education column
  },
  experience: {
    x: 12.22,  // Left position of experience column
    w: 13.15   // Width of experience column
  },

  // Row positions - all rows have unified height of 3.3 cm
  rows: [
    { y: 1.75, h: 3.3 },   // Row 1
    { y: 5.05, h: 3.3 },   // Row 2
    { y: 8.35, h: 3.3 },   // Row 3
    { y: 11.65, h: 3.3 },  // Row 4
  ],
};
