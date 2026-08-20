import { http, HttpResponse } from "msw"

export const mockParkGrid = {
  features: [
    {
      type: "Feature",
      properties: { cell_id: "cell-1", row: 0, col: 0 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [20.33, -34.41],
            [20.34, -34.41],
            [20.34, -34.40],
            [20.33, -34.40],
            [20.33, -34.41],
          ],
        ],
      },
    },
  ],
};

export const parkZoneHandlers = [
  http.post("**/v1/risk/upload*", () => {
    return HttpResponse.json({ message: "Upload successful" }, { status: 201 });
  }),
  http.get("**/v1/risk/grid*", () => {
    return HttpResponse.json(mockParkGrid);
  }),
  http.delete("**/v1/risk/upload*", () => {
    return HttpResponse.json({ message: "Deleted successfully" });
  }),
];

export const uploadErrorHandlers = [
  http.post("**/v1/risk/upload*", () => {
    return new HttpResponse(null, { status: 500 });
  }),
];

export const deleteErrorHandlers = [
  http.delete("**/v1/risk/upload*", () => {
    return new HttpResponse(null, { status: 500 });
  }),
];
