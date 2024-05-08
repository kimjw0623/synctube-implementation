
export default (sequelize, DataTypes) => {
    const Participant = sequelize.define("participant", {
        user_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        room_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'rooms',
                key: 'id'
            }
        }
    });

    return Participant;
};
