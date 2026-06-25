### AI strats
**Risk Scoring**
*   Poaching data is imbalanced (lots of "safe days", few "poaching event" days). 
*   We shouldnt use deep learning or neural nets. They need a lot of data and are difficult to translate into reasoning. Instead, **Random Forests** or **Gradient Boosting** would work much better. They handle tabular & spatial data well and we can determine reasoning easily.

*   **A few points to consider:**
    *   Distance to nearest road/gate.
    *   Distance to water sources (animals gather).
    *   Moon phase (visibility, I had not considered this orignally).
    *   Terrain slope (poachers avoid steep cliffs).

* **Route Optimization**
    1.  Create a "Cost Surface Map" grid. High poaching risk = high reward. Thick bush/steep hills = high travel cost.
    2.  Use a pathfinding algorithm like A*, Dijkstra, or Ant Colony Optimization to draw a path that maximizes reward while minimizing cost. 

* We will need to discuss the ranges around a route that consider an area "covered". 

---

### Data Collection

Rangers might be wearing gloves, in the dark, or under the sun. Oversized buttons will help. Use dropdowns and toggles instead of typing text whenever possible.

Could have to account for multiple reports for the same event. We'd have to defer cases like these to an admin or analyst or something of the kind. How do we flag these cases to send to a reviewer though? Some techniques for entity resolution include the Fellegi-Sunter Model and Jaccard Similarity.